import {MessageTypeEnum, myIframeMessenger} from './messenger-setup.example.js';

async function sendMyMessage(iframeElement: HTMLIFrameElement) {
    const childValue: string = (
        await myIframeMessenger.sendMessageToChild({
            iframeElement,
            childOrigin: 'https://example.com',
            type: MessageTypeEnum.RequestDataFromChild,
            data: undefined,
            // if data is expected from the child, a verifyChildData function must be provided
            verifyChildData(childData) {
                return typeof childData === 'string';
            },
        })
    ).data;

    // this will end up logging the string value that the child generated
    console.log({childValue});
}

sendMyMessage(
    // pass in a reference to your iframe
    document.querySelector('iframe')!,
);
