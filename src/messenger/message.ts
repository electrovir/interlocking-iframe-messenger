export type Message<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends MessageDataBase,
    MessageDirectionGeneric extends MessageDirectionEnum,
> = {
    [SpecificMessageType in MessageType]: {
        type: SpecificMessageType;
        direction: MessageDirectionGeneric;
        messageId: string;
    } & (undefined extends MessageDataOptions[SpecificMessageType][MessageDirectionGeneric]
        ? {data?: MessageDataOptions[SpecificMessageType][MessageDirectionGeneric]}
        : {data: MessageDataOptions[SpecificMessageType][MessageDirectionGeneric]});
}[MessageType];

export type MessageDataBase = Record<
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
