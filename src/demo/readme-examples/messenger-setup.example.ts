import {createIframeMessenger, MessageDirectionEnum} from '../..';

export enum MessageTypeEnum {
    RequestDataFromChild = 'request-data-from-child',
    SendDataToChild = 'send-data-to-child',
}

export type MessageData = {
    [MessageTypeEnum.RequestDataFromChild]: {
        [MessageDirectionEnum.FromParent]: undefined;
        [MessageDirectionEnum.FromChild]: string;
    };
    [MessageTypeEnum.SendDataToChild]: {
        [MessageDirectionEnum.FromParent]: string;
        [MessageDirectionEnum.FromChild]: undefined;
    };
};

export const myIframeMessenger = createIframeMessenger<MessageData>({
    allowedOrigins: ['https://example.com'],
});
