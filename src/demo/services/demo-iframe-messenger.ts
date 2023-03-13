import {createIframeMessenger, MessageDirectionEnum} from '../..';

export type IframeMessageData = {
    sendStringToChild: {
        [MessageDirectionEnum.FromParent]: string;
        [MessageDirectionEnum.FromChild]: undefined;
    };
    requestNumberFromChild: {
        [MessageDirectionEnum.FromParent]: undefined;
        [MessageDirectionEnum.FromChild]: number;
    };
};

export const demoIframeMessenger = createIframeMessenger<IframeMessageData>({
    allowedOrigins: [window.location.origin],
});
