import {RequiredAndNotNull} from '@augment-vir/common';
import {GlobalMessenger} from './global-object-for-messaging.js';
import {BaseIframeMessageData, IframeMessage, IframeMessageDirectionEnum} from './message.js';

/** @category Internal */
export type IframeMessageForChildParams<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends BaseIframeMessageData,
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
    data: IframeMessage<
        MessageType,
        MessageDataOptions,
        IframeMessageDirectionEnum.FromParent
    >['data'];
    globalObject?: GlobalMessenger | undefined;
    /** A custom checker for verifying data from the child is correct. */
    verifyChildData?: (
        data:
            | Readonly<
                  IframeMessage<
                      MessageType,
                      MessageDataOptions,
                      IframeMessageDirectionEnum.FromChild
                  >['data']
              >
            | undefined,
    ) => boolean;
};

/** @category Internal */
export type IframeMessengerOptions = {
    /**
     * The maximum amount of time in milliseconds that the messenger will wait for a response to
     * come back from the iframe. This defaults to 10,000 milliseconds (10 seconds).
     */
    timeout?: {milliseconds: number} | undefined;
};

/** @category Internal */
export const defaultIframeMessengerOptions: RequiredAndNotNull<IframeMessengerOptions> = {
    timeout: {
        milliseconds: 10_000,
    },
};
