import {isDebugMode} from '../debug-mode.js';
import {isAllowedOrigin} from './allowed-origin.js';
import {IframeMessenger} from './iframe-messenger.js';
import {BaseIframeMessageData, IframeMessage, IframeMessageDirectionEnum} from './message.js';
import {IframeMessengerOptions, defaultIframeMessengerOptions} from './send-message-inputs.js';
import {sendPingPongMessageToChild} from './send-ping-pong-message-to-child.js';

/**
 * This is the core of the `interlocking-iframe-messenger` package. Use this to create a messenger
 * and then use that messenger to start sending messages to an iframe.
 *
 * @category Main
 */
export function createIframeMessenger<MessageDataOptions extends BaseIframeMessageData>({
    timeout = defaultIframeMessengerOptions.timeout,
}: IframeMessengerOptions = defaultIframeMessengerOptions): IframeMessenger<MessageDataOptions> {
    return {
        async sendMessageToChild(inputs) {
            if (inputs.type === 'error') {
                throw new Error(
                    `Cannot send message to child with type 'error'. 'error' is reserved for internal error messaging.`,
                );
            }

            return await sendPingPongMessageToChild(
                inputs,
                inputs.childOrigin,
                inputs.timeout || timeout,
                inputs.interval,
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
                        !!inputs.options?._DANGER_ignoreAnyOriginWarning,
                    )
                ) {
                    return;
                }
                const messageFromParent: IframeMessage<
                    keyof MessageDataOptions,
                    MessageDataOptions,
                    IframeMessageDirectionEnum.FromParent
                > = messageEvent.data;

                /* node-coverage ignore next 7: ignore debug logging */
                if (isDebugMode()) {
                    console.info(
                        'Received message from parent',
                        messageFromParent.messageId,
                        messageFromParent,
                    );
                }

                const responseData = await inputs.listener(
                    {
                        ...messageFromParent,
                        originalEvent: messageEvent,
                    },
                    () => {
                        globalObject.removeEventListener('message', listenCallback);
                    },
                );
                const messageForParent: IframeMessage<
                    any,
                    any,
                    IframeMessageDirectionEnum.FromChild
                > = {
                    type: messageFromParent.type,
                    direction: IframeMessageDirectionEnum.FromChild,
                    data: responseData,
                    messageId: messageFromParent.messageId,
                };

                /* node-coverage ignore next 7: ignore debug logging */
                if (isDebugMode()) {
                    console.info(
                        'Sending message to parent',
                        messageForParent.messageId,
                        messageForParent,
                    );
                }

                globalObject.parent.postMessage(messageForParent, {
                    targetOrigin: inputs.parentOrigin,
                });
            }
            globalObject.addEventListener('message', listenCallback);
        },
    };
}
