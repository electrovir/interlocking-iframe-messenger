/**
 * Messages sent to and from iframes.
 *
 * @category Internal
 */
export type IframeMessage<
    MessageType extends keyof MessageDataOptions,
    MessageDataOptions extends BaseIframeMessageData,
    MessageDirectionGeneric extends IframeMessageDirectionEnum,
> = {
    [SpecificMessageType in MessageType]: {
        type: SpecificMessageType;
        direction: MessageDirectionGeneric;
        messageId: string;
        data: MessageDataOptions[SpecificMessageType][MessageDirectionGeneric];
    };
}[MessageType];

/**
 * Used for {@link IframeMessage}.
 *
 * @category Internal
 */
export type BaseIframeMessageData = Record<
    string,
    {
        [IframeMessageDirectionEnum.FromChild]: unknown;
        [IframeMessageDirectionEnum.FromParent]: unknown;
    }
>;

/** @category Internal */
export enum IframeMessageDirectionEnum {
    FromParent = 'from-parent',
    FromChild = 'from-child',
}
