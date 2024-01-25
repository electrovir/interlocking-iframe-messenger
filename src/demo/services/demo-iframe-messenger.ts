import {createIframeMessenger, MessageDirectionEnum} from '../..';

export type DemoMessageData = {
    sendStringToChild: {
        [MessageDirectionEnum.FromParent]: string;
        [MessageDirectionEnum.FromChild]: undefined;
    };
    requestNumberFromChild: {
        [MessageDirectionEnum.FromParent]: undefined;
        [MessageDirectionEnum.FromChild]: number;
    };
};

export const demoIframeMessenger = createIframeMessenger<DemoMessageData>({});
