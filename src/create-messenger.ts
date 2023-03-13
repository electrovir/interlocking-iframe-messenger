import {ensureError, MaybePromise, wait} from '@augment-vir/common';
import {dangerDisableSecurityWarningsSymbol} from './danger-disable-security-warnings';

export enum MessageDirection {
    FromParent = 'from-parent',
    FromChild = 'from-child',
}

export type Message<
    MessageType extends keyof DataTypeOptions,
    DataTypeOptions extends Record<string, any>,
    MessageDirectionGeneric extends MessageDirection,
> = {
    type: MessageType;
    direction: MessageDirectionGeneric;
} & (undefined extends DataTypeOptions[MessageType][MessageDirectionGeneric]
    ? {data?: DataTypeOptions[MessageType][MessageDirectionGeneric]}
    : {data: DataTypeOptions[MessageType][MessageDirectionGeneric]});

function isMessageKind<
    MessageType extends keyof DataTypeOptions,
    DataTypeOptions extends Record<string, any>,
    MessageDirectionGeneric extends MessageDirection,
>(
    type: MessageType,
    direction: MessageDirectionGeneric,
    message: Readonly<Message<MessageType, any, MessageDirection>>,
): message is Message<MessageType, DataTypeOptions, MessageDirectionGeneric> {
    return message.type === type && message.direction === direction;
}

type GenericSendMessageInputs<
    MessageType extends keyof DataTypeOptions,
    DataTypeOptions extends Record<string, any>,
> = {
    iframeElement: HTMLIFrameElement;
    maxAttemptCount?: number | undefined;
    message: Omit<
        Message<
            MessageType,
            DataTypeOptions,
            /**
             * Always use FromParent here because the child doesn't have access to this TypeScript
             * code, so we can't share this function with it :'(
             */
            MessageDirection.FromParent
        >,
        'direction'
    >;
} & (Message<MessageType, DataTypeOptions, MessageDirection.FromChild>['data'] extends undefined
    ? {verifyData?: undefined}
    : {
          verifyData: (
              data: Readonly<
                  Message<MessageType, DataTypeOptions, MessageDirection.FromChild>['data']
              >,
          ) => boolean;
      });

/**
 * @deprecated Using any origin with iframe communication is dangerous! Please provide an actual
 *   array of allowed origins.
 */
export const AnyOrigin = Symbol('any-origin');
export type AllowedOrigins = ReadonlyArray<string> | typeof AnyOrigin;

function assertAllowedOrigin(allowedOrigins: AllowedOrigins, messageEvent: MessageEvent) {
    if (allowedOrigins === AnyOrigin) {
        return;
    }
    const matchedOrigins = allowedOrigins.filter(
        (allowedOrigin) => messageEvent.origin === allowedOrigin,
    );

    if (!matchedOrigins.length) {
        throw new Error(`Received message from invalid origin: ${messageEvent.origin}`);
    }
}

export type IframeMessengerOptions = {
    /**
     * A list of allowed origins for the iframe to communicate with. Not providing this or allowing
     * any origin is insecure, please provide a valid list of origins.
     */
    allowedOrigins: AllowedOrigins;
    /**
     * The maximum amount of times that the messenger will try to send and receive a response from
     * the iframe. This defaults to 10.
     */
    maxAttemptCount?: number | undefined;
};

export type IframeMessenger<DataTypeOptions extends Record<string, any>> = {
    sendMessageToChild: <SpecificMessageType extends keyof DataTypeOptions>(
        inputs: GenericSendMessageInputs<SpecificMessageType, DataTypeOptions>,
    ) => Promise<DataTypeOptions[SpecificMessageType][MessageDirection.FromChild]>;
    listenForParentMessages: (
        callback: (
            message: Message<keyof DataTypeOptions, DataTypeOptions, MessageDirection.FromParent>,
        ) => MaybePromise<DataTypeOptions[keyof DataTypeOptions][MessageDirection.FromChild]>,
    ) => void;
};

export function createIframeMessenger<DataTypeOptions extends Record<string, any>>({
    allowedOrigins,
    maxAttemptCount = 10,
    ...otherOptions
}: IframeMessengerOptions): IframeMessenger<DataTypeOptions> {
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
                    keyof DataTypeOptions,
                    DataTypeOptions,
                    MessageDirection.FromParent
                > = messageEvent.data;

                if (message.direction !== MessageDirection.FromParent) {
                    return;
                }

                const responseData = await callback(message);
                const messageForParent = {
                    type: message.type,
                    direction: MessageDirection.FromChild,
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

const baseDurationWait = 10;

function calculateAttemptWaitDuration(attemptCount: number) {
    return Math.min(
        Math.max(Math.floor(Math.pow(attemptCount + 1, 3) * baseDurationWait), baseDurationWait),
        5000,
    );
}

async function sendPingPongMessage(
    {message: messageToSend, verifyData, iframeElement}: GenericSendMessageInputs<any, any>,
    allowedOrigins: AllowedOrigins,
    maxAttemptCount: number,
): Promise<any> {
    if (!iframeElement) {
        throw new Error(`No iframe element was provided.`);
    }
    let tryCount = 0;
    let validResponseReceived = false;
    /**
     * As cast necessary because this value gets set in callbacks and TypeScript can't figure out
     * that it ever gets set to anything other than undefined.
     */
    let responseMessage: Message<any, any, any> | undefined = undefined as
        | Message<any, any, any>
        | undefined;
    let listenerError: Error | undefined;
    let messagePosted = false;
    const fullMessageToSend: Omit<Message<any, any, MessageDirection.FromParent>, 'direction'> & {
        direction: MessageDirection.FromParent;
    } = {
        ...messageToSend,
        direction: MessageDirection.FromParent,
    };

    const expectedMessageType = messageToSend.type;

    function responseListener(messageEvent: MessageEvent<any>) {
        try {
            assertAllowedOrigin(allowedOrigins, messageEvent);

            const receivedMessage: Message<any, any, any> = messageEvent.data;

            if (receivedMessage.direction !== MessageDirection.FromChild) {
                return;
            }

            if (receivedMessage.type === 'error') {
                throw new Error(`Child threw an error: ${receivedMessage.data}`);
            }

            if (
                receivedMessage &&
                messagePosted &&
                isMessageKind(expectedMessageType, MessageDirection.FromChild, receivedMessage)
            ) {
                let isDataValid = false;
                try {
                    isDataValid = verifyData ? verifyData(receivedMessage.data as any) : true;
                } catch (error) {}

                if (!isDataValid) {
                    return;
                }

                validResponseReceived = true;
                responseMessage = receivedMessage;
            }
        } catch (error) {
            listenerError = ensureError(error);
        }
    }

    function getMessageContext() {
        return iframeElement.contentWindow;
    }

    let previousContext = getMessageContext();
    previousContext?.addEventListener('message', responseListener);

    const startTime = Date.now();

    while (!validResponseReceived && tryCount < maxAttemptCount && !listenerError) {
        await wait(calculateAttemptWaitDuration(tryCount));
        const newContext = getMessageContext();

        if (newContext) {
            previousContext?.removeEventListener('message', responseListener);
            newContext.addEventListener('message', responseListener);
            if (newContext !== previousContext) {
                previousContext = newContext;
            }
            messagePosted = true;
            newContext.postMessage(fullMessageToSend);
        }
        tryCount++;
    }
    const attemptDuration = Date.now() - startTime;

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

    return responseMessage?.data;
}
