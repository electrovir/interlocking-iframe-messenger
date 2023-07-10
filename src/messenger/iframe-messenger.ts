import {MaybePromise} from '@augment-vir/common';
import {Message} from './create-messenger';
import {GenericSendMessageInputs, MessageDirectionEnum} from './messenger-inputs';

export type IframeMessenger<MessageDataOptions extends MessageDataBase> = {
    sendMessageToChild: <SpecificMessageType extends keyof MessageDataOptions>(
        inputs: GenericSendMessageInputs<SpecificMessageType, MessageDataOptions>,
    ) => Promise<{
        data: MessageDataOptions[SpecificMessageType][MessageDirectionEnum.FromChild];
        event: MessageEvent;
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
            message: Message<
                keyof MessageDataOptions,
                MessageDataOptions,
                MessageDirectionEnum.FromParent
            > & {originalEvent: MessageEvent},
        ) => MaybePromise<
            MessageDataOptions[keyof MessageDataOptions][MessageDirectionEnum.FromChild]
        >;
    }) => void;
};

export type MessageDataBase = Record<
    string,
    {
        [MessageDirectionEnum.FromChild]: unknown;
        [MessageDirectionEnum.FromParent]: unknown;
    }
>;
