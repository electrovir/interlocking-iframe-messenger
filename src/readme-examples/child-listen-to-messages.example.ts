import {MessageTypeEnum, myIframeMessenger} from './messenger-setup.example';

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
