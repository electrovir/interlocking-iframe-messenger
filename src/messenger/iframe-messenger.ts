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
    listenForParentMessages: (
        callback: (
            message: Message<
                keyof MessageDataOptions,
                MessageDataOptions,
                MessageDirectionEnum.FromParent
            > & {originalEvent: MessageEvent},
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
