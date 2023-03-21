import {isDebugMode} from '../debug-mode';
import {assertAllowedOrigin} from './assert-allowed-origin';
import {dangerDisableSecurityWarningsSymbol} from './danger-disable-security-warnings';
import {IframeMessenger, MessageDataBase} from './iframe-messenger';
import {AnyOrigin, IframeMessengerOptions, MessageDirectionEnum} from './messenger-inputs';
import {sendPingPongMessageToChild} from './send-ping-ping-message-to-child';

export type Message<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends MessageDataBase,
    MessageDirectionGeneric extends MessageDirectionEnum,
> = {
    [SpecificMessageType in MessageType]: {
        type: SpecificMessageType;
        direction: MessageDirectionGeneric;
        messageId: string;
    } & (undefined extends MessageDataOptions[SpecificMessageType][MessageDirectionGeneric]
        ? {data?: MessageDataOptions[SpecificMessageType][MessageDirectionGeneric]}
        : {data: MessageDataOptions[SpecificMessageType][MessageDirectionGeneric]});
}[MessageType];

export function createIframeMessenger<MessageDataOptions extends MessageDataBase>({
    allowedOrigins,
    maxAttemptCount = 10,
    ...otherOptions
}: IframeMessengerOptions): IframeMessenger<MessageDataOptions> {
    if (allowedOrigins !== AnyOrigin && allowedOrigins.includes('*')) {
        allowedOrigins = AnyOrigin;
    }
    if (
        allowedOrigins === AnyOrigin &&
        !(otherOptions as any)[dangerDisableSecurityWarningsSymbol]
    ) {
        console.warn(
            "Creating iframe messenger with any origin allowed ('*'). This is insecure, please provide an actual list of allowed origins.",
        );
    }

    if (allowedOrigins !== AnyOrigin && !allowedOrigins.length) {
        throw new Error(
            `No allowed origins were provide to ${createIframeMessenger.name}. At least one must be provided.`,
        );
    }

    return {
        async sendMessageToChild(inputs) {
            if (inputs.message.type === 'error') {
                throw new Error(
                    `Cannot send message to child with type 'error'. 'error' is reserved for internal error messaging.`,
                );
            }

            return await sendPingPongMessageToChild(
                inputs,
                allowedOrigins,
                inputs.maxAttemptCount || maxAttemptCount,
            );
        },
        listenForParentMessages(callback) {
            globalThis.addEventListener('message', async (messageEvent) => {
                assertAllowedOrigin(allowedOrigins, messageEvent);
                const messageFromParent: Message<
                    keyof MessageDataOptions,
                    MessageDataOptions,
                    MessageDirectionEnum.FromParent
                > = messageEvent.data;

                // ignore debug logging
                /* c8 ignore start */
                if (isDebugMode()) {
                    console.info(
                        'Received message from parent',
                        messageFromParent.messageId,
                        messageFromParent,
                    );
                }
                /* c8 ignore stop */

                const responseData = await callback({
                    ...messageFromParent,
                    originalEvent: messageEvent,
                });
                const messageForParent: Message<any, any, MessageDirectionEnum.FromChild> = {
                    type: messageFromParent.type,
                    direction: MessageDirectionEnum.FromChild,
                    data: responseData,
                    messageId: messageFromParent.messageId,
                };

                // ignore debug logging
                /* c8 ignore start */
                if (isDebugMode()) {
                    console.info(
                        'Sending message to parent',
                        messageForParent.messageId,
                        messageForParent,
                    );
                }
                /* c8 ignore stop */
                if (allowedOrigins === AnyOrigin) {
                    globalThis.parent.postMessage(messageForParent);
                } else {
                    allowedOrigins.forEach((targetOrigin) => {
                        globalThis.parent.postMessage(messageForParent, {targetOrigin});
                    });
                }
            });
        },
    };
}
