# interlocking-iframe-messenger

Post messages to a child iframe while accounting for race conditions.

Potential race conditions that are handled include:

-   [x] waiting for the iframe to load
-   [x] waiting for the iframe content to finish loading (yes, this is different from the condition above)
-   [x] any lag in the iframe content from scripts
-   [x] anything else that may cause an iframe to miss a message

Currently this only works as the parent content being the communication initiator. The child only responds to messages from the parent, it doesn't send messages of its own accord. If the parent is ready for specific data from the child, it must send a message to request that data.

See a simple live demo at [electrovir.github.io/interlocking-iframe-messenger](https://electrovir.github.io/interlocking-iframe-messenger).

## install

```bash
npm i interlocking-iframe-messenger
```

## usage

Follow the headings below in order for a full usage example.

### setup

First, setup an iframeMessenger. Make sure to provide a list of allowed origins for security purposes. (If you do not provide any, warnings will be logged in your console.)

Make sure to provide a generic type to `createIframeMessenger` so that your message data is typed. The given type should match a similar structure to `MessageData` shown below.

<!-- example-link: src/readme-examples/messenger-setup.example.ts -->

```TypeScript
import {createIframeMessenger, IframeMessageDirectionEnum} from 'interlocking-iframe-messenger';

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
```

### send a message to the child iframe

Use the `.sendMessageToChild()` method on `IframeMessenger` to send messages to the child iframe.

Based on the given message type, if data is expected from the child iframe, a `verifyChildData` function must be provided. This will get called internally by `sendMessageToChild` and if `verifyChildData` returns false, `sendMessageToChild` will fail.

<!-- example-link: src/readme-examples/parent-send-message.example.ts -->

```TypeScript
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
```

### listen to messages from the parent

Use `.listenForParentMessages()` in the child iframe source code to properly handle parent messages and respond when required. Notice that, in the example below, when the parent is expecting a response (when the type is `MessageTypeEnum.RequestDataFromChild`), the listener directly returns the data which the parent is expecting and waiting for.

<!-- example-link: src/readme-examples/child-listen-to-messages.example.ts -->

```TypeScript
import {MessageTypeEnum, myIframeMessenger} from './messenger-setup.example.js';

myIframeMessenger.listenForParentMessages({
    parentOrigin: 'https://example.com',
    listener: (message) => {
        if (message.type === MessageTypeEnum.RequestDataFromChild) {
            // send the data that the parent is expecting
            return 'some string from the child';
        } else if (message.type === MessageTypeEnum.SendDataToChild) {
            const parentData = message.data;

            // process parentData here
        }

        return undefined;
    },
});
```
