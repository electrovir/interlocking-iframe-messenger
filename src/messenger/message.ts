export type Message<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends BaseMessageData,
    MessageDirectionGeneric extends MessageDirectionEnum,
> = {
    [SpecificMessageType in MessageType]: {
        type: SpecificMessageType;
        direction: MessageDirectionGeneric;
        messageId: string;
        data: MessageDataOptions[SpecificMessageType][MessageDirectionGeneric];
    };
}[MessageType];

export type BaseMessageData = Record<
    string,
    {
        [MessageDirectionEnum.FromChild]: unknown;
        [MessageDirectionEnum.FromParent]: unknown;
    }
>;

export enum MessageDirectionEnum {
    FromParent = 'from-parent',
    FromChild = 'from-child',
}
