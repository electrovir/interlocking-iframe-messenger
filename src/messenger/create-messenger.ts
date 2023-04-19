import {isDebugMode} from '../debug-mode';
import {isAllowedOrigin} from './assert-allowed-origin';
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
    timeoutMs = 10_000,
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

    const allowedOriginsArray = allowedOrigins === AnyOrigin ? ['*'] : allowedOrigins;

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
                inputs.timeoutMs || timeoutMs,
                inputs.intervalMs,
            );
        },
        listenForParentMessages(callback) {
            globalThis.addEventListener('message', async (messageEvent) => {
                if (!isAllowedOrigin(allowedOrigins, messageEvent)) {
                    return;
                }
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

                allowedOriginsArray.forEach((targetOrigin) => {
                    try {
                        globalThis.parent.postMessage(messageForParent, {targetOrigin});
                    } catch (error) {}
                });
            });
        },
    };
}
