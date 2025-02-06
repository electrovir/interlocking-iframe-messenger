import {IframeMessageForChildParams} from '../../../messenger/send-message-inputs.js';
import {DemoMessageData, demoIframeMessenger} from '../../services/demo-iframe-messenger.js';

export async function sendComposableMessage<MessageType extends keyof DemoMessageData>(
    iframeElement: HTMLIFrameElement,
    message: Pick<
        IframeMessageForChildParams<MessageType, DemoMessageData>,
        'data' | 'verifyChildData' | 'type'
    >,
) {
    const sendMessageInputs: IframeMessageForChildParams<MessageType, DemoMessageData> = {
        iframeElement: iframeElement,
        childOrigin: window.location.origin,
        ...message,
    };

    const result = await demoIframeMessenger.sendMessageToChild(sendMessageInputs);
}
