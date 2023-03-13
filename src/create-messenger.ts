import {ensureError, MaybePromise, wait} from '@augment-vir/common';
import {dangerDisableSecurityWarningsSymbol} from './danger-disable-security-warnings';

export enum MessageDirectionEnum {
    FromParent = 'from-parent',
    FromChild = 'from-child',
}

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

type GenericSendMessageInputs<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends MessageDataBase,
> = {
    iframeElement: HTMLIFrameElement;
    maxAttemptCount?: number | undefined;
    message: Omit<
        Message<
            MessageType,
            MessageDataOptions,
            /**
             * Always use FromParent here because the child doesn't have access to this TypeScript
             * code, so we can't share this function with it :'(
             */
            MessageDirectionEnum.FromParent
        >,
        'direction'
    >;
} & (Message<
    MessageType,
    MessageDataOptions,
    MessageDirectionEnum.FromChild
>['data'] extends undefined
    ? {verifyChildData?: undefined}
    : {
          verifyChildData: (
              data: Readonly<
                  Message<MessageType, MessageDataOptions, MessageDirectionEnum.FromChild>['data']
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

export type IframeMessenger<MessageDataOptions extends MessageDataBase> = {
    sendMessageToChild: <SpecificMessageType extends keyof MessageDataOptions>(
        inputs: GenericSendMessageInputs<SpecificMessageType, MessageDataOptions>,
    ) => Promise<MessageDataOptions[SpecificMessageType][MessageDirectionEnum.FromChild]>;
    listenForParentMessages: (
        callback: (
            message: Message<
                keyof MessageDataOptions,
                MessageDataOptions,
                MessageDirectionEnum.FromParent
            >,
        ) => MaybePromise<
            MessageDataOptions[keyof MessageDataOptions][MessageDirectionEnum.FromChild]
        >,
    ) => void;
};

export type MessageDataBase = Record<
    string,
    {
        [MessageDirectionEnum.FromChild]: unknown;
        [MessageDirectionEnum.FromParent]: unknown;
    }
>;

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

                const responseData = await callback(message);
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

function calculateAttemptWaitDuration(attemptCount: number) {
    const waitDuration = Math.min(Math.floor(Math.pow(attemptCount, 3)), 5000);

    return waitDuration;
}

// console.info(
//     Array(20)
//         .fill(0)
//         .map((value, index) => calculateAttemptWaitDuration(index)),
// );

async function sendPingPongMessage(
    {message: messageToSend, verifyChildData, iframeElement}: GenericSendMessageInputs<any, any>,
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
                responseMessage = receivedMessage;
            }
        } catch (error) {
            listenerError = ensureError(error);
        }
    }

    let previousContext: Window | null | undefined = undefined;

    const startTime = Date.now();

    while (!validResponseReceived && tryCount < maxAttemptCount && !listenerError) {
        const newContext = iframeElement.contentWindow;

        if (newContext) {
            previousContext?.removeEventListener('message', responseListener);
            newContext.addEventListener('message', responseListener);
            if (newContext !== previousContext) {
                previousContext = newContext;
            }
            messagePosted = true;
            newContext.postMessage(fullMessageToSend);
        }
        await wait(calculateAttemptWaitDuration(tryCount));
        tryCount++;
    }
    const attemptDuration = Date.now() - startTime;
    previousContext?.removeEventListener('message', responseListener);

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
