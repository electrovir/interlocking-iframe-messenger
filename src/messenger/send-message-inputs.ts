import {RequiredAndNotNull} from '@augment-vir/common';
import {GlobalMessenger} from './global-object-for-messaging';
import {BaseMessageData, Message, MessageDirectionEnum} from './message';

export type MessageForChildParams<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends BaseMessageData,
> = {
    iframeElement: HTMLIFrameElement;
    timeout?: {milliseconds: number} | undefined;
    interval?: {milliseconds: number} | undefined;
    /**
     * The origin that the child must have for this message to be allowed to be sent. You can
     * insecurely set this to '*' to allow any origin but you will receive warning messages for
     * doing such.
     */
    childOrigin: string;
    type: MessageType;
    data: Message<MessageType, MessageDataOptions, MessageDirectionEnum.FromParent>['data'];
    globalObject?: GlobalMessenger | undefined;
    verifyChildData?: (
        data:
            | Readonly<
                  Message<MessageType, MessageDataOptions, MessageDirectionEnum.FromChild>['data']
              >
            | undefined,
    ) => boolean;
};

export type IframeMessengerOptions = {
    /**
     * The maximum amount of time in milliseconds that the messenger will wait for a response to
     * come back from the iframe. This defaults to 10,000 milliseconds (10 seconds).
     */
    timeout?: {milliseconds: number} | undefined;
};

export const defaultIframeMessengerOptions: RequiredAndNotNull<IframeMessengerOptions> = {
    timeout: {
        milliseconds: 10_000,
    },
};
