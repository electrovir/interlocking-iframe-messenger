import {isDebugMode} from '../debug-mode';
import {isAllowedOrigin} from './allowed-origin';
import {IframeMessenger} from './iframe-messenger';
import {Message, MessageDataBase, MessageDirectionEnum} from './message';
import {IframeMessengerOptions} from './messenger-inputs';
import {sendPingPongMessageToChild} from './send-ping-ping-message-to-child';

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
                inputs.globalObject ?? globalThis,
            );
        },
        listenForParentMessages(inputs) {
            const globalObject = inputs.globalObject ?? globalThis;
            async function listenCallback(messageEvent: MessageEvent) {
                if (
                    !isAllowedOrigin(
                        inputs.parentOrigin,
                        messageEvent,
                        !!inputs._options?._DANGER_ignoreAnyOriginWarning,
                    )
                ) {
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

                const responseData = await inputs.listener(
                    {
                        ...messageFromParent,
                        originalEvent: messageEvent,
                    },
                    () => {
                        globalObject.removeEventListener('message', listenCallback);
                    },
                );
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

                globalObject.parent.postMessage(messageForParent, {
                    targetOrigin: inputs.parentOrigin,
                });
            }
            globalObject.addEventListener('message', listenCallback);
        },
    };
}
