import {ensureError, randomString, wait} from '@augment-vir/common';
import {convertDuration, type AnyDuration} from 'date-vir';
import {isDebugMode} from '../debug-mode.js';
import {IframeDisconnectedError} from '../errors/iframe-disconnected.error.js';
import {isAllowedOrigin} from './allowed-origin.js';
import {GlobalMessenger} from './global-object-for-messaging.js';
import {BaseIframeMessageData, IframeMessage, IframeMessageDirectionEnum} from './message.js';
import {IframeMessageForChildParams} from './send-message-inputs.js';

function isMessageKind<
    SpecificMessageType extends keyof MessageDataOptions,
    MessageDataOptions extends BaseIframeMessageData,
    MessageDirectionGeneric extends IframeMessageDirectionEnum,
>(
    type: SpecificMessageType,
    direction: MessageDirectionGeneric,
    message: Readonly<IframeMessage<any, any, any>>,
): message is IframeMessage<SpecificMessageType, MessageDataOptions, MessageDirectionGeneric> {
    return message.type === type && message.direction === direction;
}

function calculateAttemptWaitDuration(attemptCount: number): AnyDuration {
    if (attemptCount < 2) {
        return {milliseconds: 10};
    } else if (attemptCount < 5) {
        return {milliseconds: 100};
    } else if (attemptCount < 10) {
        return {seconds: 1};
    } else {
        return {seconds: 5};
    }
}

export async function sendPingPongMessageToChild(
    {data, type, verifyChildData, iframeElement}: IframeMessageForChildParams<any, any>,
    requiredOrigin: string,
    timeout: AnyDuration,
    interval: AnyDuration | undefined,
    globalObject: GlobalMessenger,
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
    let responseMessage: IframeMessage<any, any, any> | undefined;
    let responseEvent: MessageEvent | undefined;
    let listenerError: Error | undefined;
    let messagePosted = false;
    const messageToSend = {data, type};
    const fullMessageToSend: Omit<
        IframeMessage<any, any, IframeMessageDirectionEnum.FromParent>,
        'direction'
    > & {
        direction: IframeMessageDirectionEnum.FromParent;
    } = {
        ...messageToSend,
        direction: IframeMessageDirectionEnum.FromParent,
        messageId: randomString(32),
    };

    const expectedMessageType = messageToSend.type;

    function responseListener(messageEvent: MessageEvent) {
        try {
            if (!isAllowedOrigin(requiredOrigin, messageEvent, false)) {
                return;
            }

            const receivedMessage: IframeMessage<any, any, any> = messageEvent.data;

            if (receivedMessage.type === 'error') {
                throw new Error(`Child threw an error: ${receivedMessage.data}`);
            }

            /* node-coverage ignore next 7: ignore debug logging */
            if (isDebugMode()) {
                console.info(
                    'Received message from child',
                    receivedMessage.messageId,
                    receivedMessage,
                );
            }

            if (
                receivedMessage &&
                messagePosted &&
                isMessageKind(
                    expectedMessageType,
                    IframeMessageDirectionEnum.FromChild,
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
    globalObject.addEventListener('message', responseListener);

    const startTime = Date.now();

    const timeoutMs = convertDuration(timeout, {milliseconds: true}).milliseconds;

    while (!validResponseReceived && Date.now() - startTime < timeoutMs && !listenerError) {
        if (!iframeElement.isConnected) {
            throw new IframeDisconnectedError();
        }
        const iframeWindow = iframeElement.contentWindow;

        if (iframeWindow) {
            /* node-coverage ignore next 11: ignore debug logging */
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
            messagePosted = true;
            iframeWindow.postMessage(fullMessageToSend, {targetOrigin: requiredOrigin});
        }
        await wait(interval || calculateAttemptWaitDuration(tryCount));
        tryCount++;
    }
    const attemptDuration = Date.now() - startTime;

    /* node-coverage ignore next 3: ignore debug logging */
    if (isDebugMode()) {
        console.info('attempt duration', attemptDuration, 'messageId', fullMessageToSend.messageId);
    }
    globalObject.removeEventListener('message', responseListener);

    if (listenerError) {
        throw listenerError;
    }

    if (!validResponseReceived) {
        throw new Error(
            `Failed to receive response from the iframe for message '${
                messageToSend.type
            }' after '${Math.ceil(convertDuration(timeout, {seconds: true}).seconds)}' seconds).`,
        );
    }

    /* node-coverage ignore next 3: there's no way to intentionally trigger this */
    if (!responseEvent) {
        throw new Error(`Never got message event from child but received a valid response`);
    }

    return {
        data: responseMessage?.data,
        event: responseEvent,
    };
}
