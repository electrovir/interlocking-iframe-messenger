import {ensureError, wait} from '@augment-vir/common';
import {assertAllowedOrigin} from './assert-allowed-origin';
import {Message} from './create-messenger';
import {MessageDataBase} from './iframe-messenger';
import {AllowedOrigins, GenericSendMessageInputs, MessageDirectionEnum} from './messenger-inputs';

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
    const waitDuration = Math.min(Math.floor(Math.pow(attemptCount, 3)), 5000);

    return waitDuration;
}

// // use this to test all delay times
// console.info(
//     Array(20)
//         .fill(0)
//         .map((value, index) => calculateAttemptWaitDuration(index)),
// );

export async function sendPingPongMessage(
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
    };

    const expectedMessageType = messageToSend.type;

    function responseListener(messageEvent: MessageEvent<any>) {
        try {
            assertAllowedOrigin(allowedOrigins, messageEvent);

            const receivedMessage: Message<any, any, any> = messageEvent.data;

            if (receivedMessage.direction !== MessageDirectionEnum.FromChild) {
                return;
            }

            if (receivedMessage.type === 'error') {
                throw new Error(`Child threw an error: ${receivedMessage.data}`);
            }

            if (
                receivedMessage &&
                messagePosted &&
                isMessageKind(expectedMessageType, MessageDirectionEnum.FromChild, receivedMessage)
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
        if (iframeElement.contentWindow) {
            messagePosted = true;
            iframeElement.contentWindow.postMessage(fullMessageToSend);
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

    if (!responseEvent) {
        throw new Error(`Never got message event from child but `);
    }

    return {
        data: responseMessage?.data,
        event: responseEvent,
    };
}
