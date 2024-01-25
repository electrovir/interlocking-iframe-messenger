import {MessageForChildParams} from '../../../messenger/send-message-inputs';
import {DemoMessageData, demoIframeMessenger} from '../../services/demo-iframe-messenger';

export async function sendComposableMessage<MessageType extends keyof DemoMessageData>(
    iframeElement: HTMLIFrameElement,
    message: Pick<
        MessageForChildParams<MessageType, DemoMessageData>,
        'data' | 'verifyChildData' | 'type'
    >,
) {
    const sendMessageInputs: MessageForChildParams<MessageType, DemoMessageData> = {
        iframeElement: iframeElement,
        childOrigin: window.location.origin,
        ...message,
    };

    const result = await demoIframeMessenger.sendMessageToChild(sendMessageInputs);
}
