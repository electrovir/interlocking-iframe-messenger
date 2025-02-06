import {MaybePromise, PartialWithUndefined} from '@augment-vir/common';
import {GlobalMessenger} from './global-object-for-messaging.js';
import {BaseIframeMessageData, IframeMessage, IframeMessageDirectionEnum} from './message.js';
import {IframeMessageForChildParams} from './send-message-inputs.js';

/**
 * Options for {@link IframeMessenger}.
 *
 * @category Internal
 */
export type IframeListenerOptions = PartialWithUndefined<{
    /**
     * Ignores the any origin warnings. This is dangerous! Allowing any origin will expose your
     * iframe to any parent domain which can then steal your data.
     */
    _DANGER_ignoreAnyOriginWarning: boolean;
}>;

/** @category Internal */
export type IframeMessenger<MessageData extends BaseIframeMessageData> = {
    /** Sends a message to the child iframe and waits for a response. */
    sendMessageToChild: <const SpecificMessageType extends keyof MessageData>(
        inputs: Readonly<IframeMessageForChildParams<SpecificMessageType, MessageData>>,
    ) => Promise<{
        data: MessageData[SpecificMessageType][IframeMessageDirectionEnum.FromChild];
        event: MessageEvent<MessageData[SpecificMessageType][IframeMessageDirectionEnum.FromChild]>;
    }>;

    /** Use this inside an iframe to listen to messages from the parent window. */
    listenForParentMessages: (inputs: {
        /**
         * Origin of the parent's URL that this listener will listen to. Messages sent to the
         * current context from other origins will be completely ignored (rather than throwing
         * errors).
         *
         * You can insecurely set this to '*' to allow any origin, but you will receive warning
         * messages for doing so.
         */
        parentOrigin: string;
        /** This is called when a message is received. */
        listener: (
            message: IframeMessage<
                keyof MessageData,
                MessageData,
                IframeMessageDirectionEnum.FromParent
            > & {
                originalEvent: MessageEvent;
            },
            removeListener: () => void,
        ) => MaybePromise<
            MessageData[keyof MessageData][IframeMessageDirectionEnum.FromChild] | undefined
        >;
        globalObject?: GlobalMessenger;
        options?: IframeListenerOptions;
    }) => void;
};
