import {Message} from './create-messenger';
import {GlobalMessenger} from './global-object-for-messaging';
import {MessageDataBase} from './iframe-messenger';

export type GenericSendMessageInputs<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends MessageDataBase,
> = {
    iframeElement: HTMLIFrameElement;
    timeoutMs?: number | undefined;
    intervalMs?: number | undefined;
    /**
     * The origin that the child must have for this message to be allowed to be sent. You can
     * insecurely set this to '*' to allow any origin but you will receive warning messages for
     * doing such.
     */
    childOrigin: string;
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
        'direction' | 'messageId'
    >;
    globalObject?: GlobalMessenger | undefined;
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
     * The maximum amount of time in milliseconds that the messenger will wait for a response to
     * come back from the iframe. This defaults to 10,000 milliseconds (10 seconds).
     */
    timeoutMs?: number | undefined;
};
