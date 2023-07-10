import {randomString} from '@augment-vir/browser';
import {ensureError, wait} from '@augment-vir/common';
import {isDebugMode} from '../debug-mode';
import {IframeDisconnectedError} from '../errors/iframe-disconnected.error';
import {isAllowedOrigin} from './allowed-origin';
import {Message} from './create-messenger';
import {MessageDataBase} from './iframe-messenger';
import {GenericSendMessageInputs, MessageDirectionEnum} from './messenger-inputs';

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

export async function sendPingPongMessageToChild(
    {message: messageToSend, verifyChildData, iframeElement}: GenericSendMessageInputs<any, any>,
    requiredOrigin: string,
    timeoutMs: number,
    intervalMs: number | undefined,
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

    function responseListener(messageEvent: MessageEvent<any>) {
        try {
            if (!isAllowedOrigin(requiredOrigin, messageEvent)) {
                return;
            }

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

    while (!validResponseReceived && Date.now() - startTime < timeoutMs && !listenerError) {
        if (!iframeElement.isConnected) {
            throw new IframeDisconnectedError();
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
            iframeWindow.postMessage(fullMessageToSend, {targetOrigin: requiredOrigin});
        }
        await wait(intervalMs || calculateAttemptWaitDuration(tryCount));
        tryCount++;
    }
    const attemptDuration = Date.now() - startTime;
    // ignore debug logging
    /* c8 ignore start */
    if (isDebugMode()) {
        console.info('attempt duration', attemptDuration, 'messageId', fullMessageToSend.messageId);
    }
    /* c8 ignore stop */
    globalThis.removeEventListener('message', responseListener);

    if (listenerError) {
        throw listenerError;
    }

    if (!validResponseReceived) {
        throw new Error(
            `Failed to receive response from the iframe for message '${
                messageToSend.type
            }' after '${Math.ceil(timeoutMs / 1000)}' seconds).`,
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
