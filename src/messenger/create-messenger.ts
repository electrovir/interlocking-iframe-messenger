import {assertAllowedOrigin} from './assert-allowed-origin';
import {dangerDisableSecurityWarningsSymbol} from './danger-disable-security-warnings';
import {IframeMessenger, MessageDataBase} from './iframe-messenger';
import {AnyOrigin, IframeMessengerOptions, MessageDirectionEnum} from './messenger-inputs';
import {sendPingPongMessage} from './ping-ping-message';

export type Message<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends MessageDataBase,
    MessageDirectionGeneric extends MessageDirectionEnum,
> = {
    [SpecificMessageType in MessageType]: {
        type: SpecificMessageType;
        direction: MessageDirectionGeneric;
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

            return await sendPingPongMessage(
                inputs,
                allowedOrigins,
                inputs.maxAttemptCount || maxAttemptCount,
            );
        },
        listenForParentMessages(callback) {
            globalThis.addEventListener('message', async (messageEvent) => {
                assertAllowedOrigin(allowedOrigins, messageEvent);
                const message: Message<
                    keyof MessageDataOptions,
                    MessageDataOptions,
                    MessageDirectionEnum.FromParent
                > = messageEvent.data;

                if (message.direction !== MessageDirectionEnum.FromParent) {
                    return;
                }

                const responseData = await callback({
                    ...message,
                    originalEvent: messageEvent,
                });
                const messageForParent = {
                    type: message.type,
                    direction: MessageDirectionEnum.FromChild,
                    data: responseData,
                };

                if (allowedOrigins === AnyOrigin) {
                    globalThis.postMessage(messageForParent);
                } else {
                    allowedOrigins.forEach((targetOrigin) => {
                        globalThis.postMessage(messageForParent, {targetOrigin});
                    });
                }
            });
        },
    };
}
