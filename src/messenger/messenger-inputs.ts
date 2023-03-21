import {Message} from './create-messenger';
import {MessageDataBase} from './iframe-messenger';

export type GenericSendMessageInputs<
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

export enum MessageDirectionEnum {
    FromParent = 'from-parent',
    FromChild = 'from-child',
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

/**
 * @deprecated Using any origin with iframe communication is dangerous! Please provide an actual
 *   array of allowed origins.
 */
export const AnyOrigin = Symbol('any-origin');
export type AllowedOrigins = ReadonlyArray<string> | typeof AnyOrigin;