import {createIframeMessenger, IframeMessageDirectionEnum} from '../../index.js';

export type DemoMessageData = {
    sendStringToChild: {
        [IframeMessageDirectionEnum.FromParent]: string;
        [IframeMessageDirectionEnum.FromChild]: undefined;
    };
    requestNumberFromChild: {
        [IframeMessageDirectionEnum.FromParent]: undefined;
        [IframeMessageDirectionEnum.FromChild]: number;
    };
};

export const demoIframeMessenger = createIframeMessenger<DemoMessageData>({});
