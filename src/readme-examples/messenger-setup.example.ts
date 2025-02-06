import {createIframeMessenger, IframeMessageDirectionEnum} from '../index.js';

export enum MessageTypeEnum {
    RequestDataFromChild = 'request-data-from-child',
    SendDataToChild = 'send-data-to-child',
}

export type MessageData = {
    [MessageTypeEnum.RequestDataFromChild]: {
        [IframeMessageDirectionEnum.FromParent]: undefined;
        [IframeMessageDirectionEnum.FromChild]: string;
    };
    [MessageTypeEnum.SendDataToChild]: {
        [IframeMessageDirectionEnum.FromParent]: string;
        [IframeMessageDirectionEnum.FromChild]: undefined;
    };
};

export const myIframeMessenger = createIframeMessenger<MessageData>();
