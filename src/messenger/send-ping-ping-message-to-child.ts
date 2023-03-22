import {randomString} from '@augment-vir/browser';
import {ensureError, wait} from '@augment-vir/common';
import {isDebugMode} from '../debug-mode';
import {assertAllowedOrigin} from './assert-allowed-origin';
import {Message} from './create-messenger';
import {MessageDataBase} from './iframe-messenger';
import {
    AllowedOrigins,
    AnyOrigin,
    GenericSendMessageInputs,
    MessageDirectionEnum,
} from './messenger-inputs';

function isMessageKind<
    SpecificMessageType extends keyof MessageDataOptions,
    MessageDataOptions extends MessageDataBase,
    MessageDirectionGeneric extends MessageDirectionEnum,
>(
    type: SpecificMessageType,
    direction: MessageDirectionGeneric,
    message: Readonly<Message<any, any, any>>,
): message is Message<SpecificMessageType, MessageDataOptions, MessageDirectionGeneric> {
    return message.type === type && message.direction === direction;
}

function calculateAttemptWaitDuration(attemptCount: number) {
    if (attemptCount < 2) {
        return 10;
    } else if (attemptCount < 5) {
        return 100;
    } else if (attemptCount < 10) {
        return 1000;
    } else {
        return 5000;
    }
}

// // use this to test all delay times
// console.info(
//     Array(20)
//         .fill(0)
//         .map((value, index) => calculateAttemptWaitDuration(index)),
// );

export async function sendPingPongMessageToChild(
    {message: messageToSend, verifyChildData, iframeElement}: GenericSendMessageInputs<any, any>,
    allowedOrigins: AllowedOrigins,
    maxAttemptCount: number,
): Promise<{data: any; event: MessageEvent}> {
    if (!iframeElement) {
        throw new Error(`No iframe element was provided.`);
    }
    let tryCount = 0;
    let validResponseReceived = false;
    /**
     * As cast necessary because this value gets set in callbacks and TypeScript can't figure out
     * that it ever gets set to anything other than undefined.
     */
    let responseMessage: Message<any, any, any> | undefined;
    let responseEvent: MessageEvent | undefined;
    let listenerError: Error | undefined;
    let messagePosted = false;
    const fullMessageToSend: Omit<
        Message<any, any, MessageDirectionEnum.FromParent>,
        'direction'
    > & {
        direction: MessageDirectionEnum.FromParent;
    } = {
        ...messageToSend,
        direction: MessageDirectionEnum.FromParent,
        messageId: randomString(32),
    };

    const expectedMessageType = messageToSend.type;
    const allowedOriginsArray = allowedOrigins === AnyOrigin ? ['*'] : allowedOrigins;

    function responseListener(messageEvent: MessageEvent<any>) {
        try {
            assertAllowedOrigin(allowedOrigins, messageEvent);

            const receivedMessage: Message<any, any, any> = messageEvent.data;

            if (receivedMessage.type === 'error') {
                throw new Error(`Child threw an error: ${receivedMessage.data}`);
            }

            // ignore debug logging
            /* c8 ignore start */
            if (isDebugMode()) {
                console.info(
                    'Received message from child',
                    receivedMessage.messageId,
                    receivedMessage,
                );
            }
            /* c8 ignore stop */

            if (
                receivedMessage &&
                messagePosted &&
                isMessageKind(
                    expectedMessageType,
                    MessageDirectionEnum.FromChild,
                    receivedMessage,
                ) &&
                receivedMessage.messageId === fullMessageToSend.messageId
            ) {
                let isDataValid = false;
                try {
                    isDataValid = verifyChildData
                        ? verifyChildData(receivedMessage.data as any)
                        : true;
                } catch (error) {}

                if (!isDataValid) {
                    return;
                }

                validResponseReceived = true;
                responseEvent = messageEvent;
                responseMessage = receivedMessage;
            }
        } catch (error) {
            listenerError = ensureError(error);
        }
    }

    // listen on the current window for responses from the child
    globalThis.addEventListener('message', responseListener);

    const startTime = Date.now();

    while (!validResponseReceived && tryCount < maxAttemptCount && !listenerError) {
        if (!iframeElement.isConnected) {
            throw new Error(`Iframe is no longer attached to the DOM.`);
        }
        const iframeWindow = iframeElement.contentWindow;

        if (iframeWindow) {
            // ignore debug logging
            /* c8 ignore start */
            if (isDebugMode()) {
                if (messagePosted) {
                    console.info('Re-sending message to child', fullMessageToSend.messageId);
                } else {
                    console.info(
                        'Sending message to child',
                        fullMessageToSend.messageId,
                        fullMessageToSend,
                    );
                }
            }
            /* c8 ignore stop */
            messagePosted = true;
            allowedOriginsArray.forEach((targetOrigin) => {
                try {
                    iframeWindow.postMessage(fullMessageToSend, {targetOrigin});
                } catch (error) {}
            });
        }
        await wait(calculateAttemptWaitDuration(tryCount));
        tryCount++;
    }
    const attemptDuration = Date.now() - startTime;
    globalThis.removeEventListener('message', responseListener);

    if (listenerError) {
        throw listenerError;
    }

    if (!validResponseReceived) {
        throw new Error(
            `Failed to receive response from the iframe for message '${
                messageToSend.type
            }' after '${maxAttemptCount}' tries ('${Math.floor(attemptDuration / 1000)}' seconds).`,
        );
    }

    // no way to test this, just covering edge cases for types
    /* c8 ignore next 3 */
    if (!responseEvent) {
        throw new Error(`Never got message event from child but received a valid response`);
    }

    return {
        data: responseMessage?.data,
        event: responseEvent,
    };
}
