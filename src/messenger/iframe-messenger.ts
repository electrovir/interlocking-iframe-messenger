import {MaybePromise, PartialAndUndefined} from '@augment-vir/common';
import {GlobalMessenger} from './global-object-for-messaging';
import {BaseMessageData, Message, MessageDirectionEnum} from './message';
import {MessageForChildParams} from './send-message-inputs';

export type _Options = PartialAndUndefined<{
    /**
     * Ignores the any origin warnings. This is dangerous! Allowing any origin will expose your
     * iframe to any parent domain which can then steal your data.
     */
    _DANGER_ignoreAnyOriginWarning: boolean;
}>;

export type IframeMessenger<MessageData extends BaseMessageData> = {
    sendMessageToChild: <const SpecificMessageType extends keyof MessageData>(
        inputs: Readonly<MessageForChildParams<SpecificMessageType, MessageData>>,
    ) => Promise<{
        data: MessageData[SpecificMessageType][MessageDirectionEnum.FromChild];
        event: MessageEvent<MessageData[SpecificMessageType][MessageDirectionEnum.FromChild]>;
    }>;
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
            message: Message<keyof MessageData, MessageData, MessageDirectionEnum.FromParent> & {
                originalEvent: MessageEvent;
            },
            removeListener: () => void,
        ) => MaybePromise<
            MessageData[keyof MessageData][MessageDirectionEnum.FromChild] | undefined
        >;
        globalObject?: GlobalMessenger;
        _options?: _Options;
    }) => void;
};
