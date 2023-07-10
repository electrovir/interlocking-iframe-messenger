import {isDebugMode} from '../debug-mode';
import {isAllowedOrigin} from './allowed-origin';
import {IframeMessenger, MessageDataBase} from './iframe-messenger';
import {IframeMessengerOptions, MessageDirectionEnum} from './messenger-inputs';
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

export function createIframeMessenger<MessageDataOptions extends MessageDataBase>(
    {timeoutMs = 10_000}: IframeMessengerOptions = {timeoutMs: 10_000},
): IframeMessenger<MessageDataOptions> {
    return {
        async sendMessageToChild(inputs) {
            if (inputs.message.type === 'error') {
                throw new Error(
                    `Cannot send message to child with type 'error'. 'error' is reserved for internal error messaging.`,
                );
            }

            return await sendPingPongMessageToChild(
                inputs,
                inputs.childOrigin,
                inputs.timeoutMs || timeoutMs,
                inputs.intervalMs,
            );
        },
        listenForParentMessages(inputs) {
            globalThis.addEventListener('message', async (messageEvent) => {
                if (!isAllowedOrigin(inputs.parentOrigin, messageEvent)) {
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

                const responseData = await inputs.listener({
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

                globalThis.parent.postMessage(messageForParent, {
                    targetOrigin: inputs.parentOrigin,
                });
            });
        },
    };
}
