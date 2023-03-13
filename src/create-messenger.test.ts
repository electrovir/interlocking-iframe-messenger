import {assertThrows, typedAssertInstanceOf} from '@augment-vir/browser-testing';
import {convertTemplateToString} from '@augment-vir/element-vir';
import {assert, fixture as renderFixture, html} from '@open-wc/testing';
import {
    AllowedOrigins,
    AnyOrigin,
    createIframeMessenger,
    MessageDirection,
} from './create-messenger';
import {dangerDisableSecurityWarningsSymbol} from './danger-disable-security-warnings';

async function setupTest(allowedOrigins: AllowedOrigins = AnyOrigin) {
    const iframeElement = await renderFixture(
        html`
            <iframe></iframe>
        `,
    );
    typedAssertInstanceOf(iframeElement, HTMLIFrameElement);

    const messenger = createIframeMessenger<ExampleMessageData>({
        allowedOrigins,
        ...{[dangerDisableSecurityWarningsSymbol]: true},
    });

    return {
        iframe: iframeElement,
        messenger,
    };
}

type Dimensions = {
    width: number;
    height: number;
};

/**
 * These ping and pong messages are used to prevent race conditions between loading the iframe,
 * listening to its messages, and posting messages, both inside of the iframe and outside of it.
 */
enum ExampleMessageType {
    Ready = 'ready',
    SendSize = 'send-size',
    SendScale = 'set-scale',
    SendScalingMethod = 'set-scaling-method',
    ForceSize = 'force-size',
}

type ExampleMessageData = {
    [ExampleMessageType.Ready]: {
        [MessageDirection.FromParent]: undefined;
        [MessageDirection.FromChild]: undefined;
    };
    [ExampleMessageType.SendSize]: {
        [MessageDirection.FromParent]: undefined;
        [MessageDirection.FromChild]: Dimensions;
    };
    [ExampleMessageType.SendScale]: {
        [MessageDirection.FromParent]: Dimensions;
        [MessageDirection.FromChild]: undefined;
    };
    [ExampleMessageType.SendScalingMethod]: {
        [MessageDirection.FromParent]: 'pixelated' | 'default';
        [MessageDirection.FromChild]: undefined;
    };
    [ExampleMessageType.ForceSize]: {
        [MessageDirection.FromParent]: Dimensions | undefined;
        [MessageDirection.FromChild]: undefined;
    };
};

describe(createIframeMessenger.name, () => {
    it('has proper type constraints', async () => {
        async function typeTests() {
            const messenger = createIframeMessenger<ExampleMessageData>({allowedOrigins: ['']});
            try {
                // @ts-expect-error
                await messenger.sendMessageToChild();
                // should allow ExampleMessageType.Ready without any data or data verifier
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        type: ExampleMessageType.Ready,
                    },
                });
                // ExampleMessageType.SendSize requires a data verifier
                // @ts-expect-error
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        type: ExampleMessageType.SendSize,
                    },
                });
                // ExampleMessageType.SendSize requires a data verifier
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        type: ExampleMessageType.SendSize,
                    },
                    verifyData: () => {
                        return true;
                    },
                });
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    // ExampleMessageType.SendScalingMethod requires input data
                    // @ts-expect-error
                    message: {
                        type: ExampleMessageType.SendScalingMethod,
                    },
                    // ExampleMessageType.SendScalingMethod has no child data, a data verifier is not allowed
                    // @ts-expect-error
                    verifyData: () => {
                        return true;
                    },
                });
                // ExampleMessageType.SendScalingMethod requires data
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        type: ExampleMessageType.SendScalingMethod,
                        data: 'default',
                    },
                });
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        // cannot send error type
                        // @ts-expect-error
                        type: 'error',
                    },
                });
                // ExampleMessageType.SendScalingMethod requires a specific kind of data
                await messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        type: ExampleMessageType.SendScalingMethod,
                        // @ts-expect-error
                        data: 'not acceptable',
                    },
                });
            } catch (error) {}
        }
    });

    it('fails if the iframe never loads (cause it has no src url yet)', async () => {
        const {iframe, messenger} = await setupTest();

        await assertThrows(
            () =>
                messenger.sendMessageToChild({
                    iframeElement: iframe,
                    message: {
                        type: ExampleMessageType.SendScale,
                        data: {
                            width: 11,
                            height: 22,
                        },
                    },
                    maxAttemptCount: 2,
                }),
            {
                matchConstructor: Error,
            },
        );
    });

    it('succeeds if iframe acknowledges the message', async () => {
        const {iframe, messenger} = await setupTest();

        const iframeSrcDoc = html`
            <html>
                <head>
                    <script>
                        window.addEventListener('message', (event) => {
                            const message = event.data;
                            if (message.direction === '${MessageDirection.FromParent}') {
                                window.postMessage({
                                    type: message.type,
                                    direction: '${MessageDirection.FromChild}',
                                    data: undefined,
                                });
                            }
                        });
                    </script>
                </head>
                <body></body>
            </html>
        `;

        iframe.srcdoc = convertTemplateToString(iframeSrcDoc);

        const result = await messenger.sendMessageToChild({
            iframeElement: iframe,
            message: {
                type: ExampleMessageType.SendScale,
                data: {
                    width: 11,
                    height: 22,
                },
            },
        });

        // undefined because the child responded with undefined as the message data
        assert.isUndefined(result);
    });

    it('fails if iframe loads but never responds to the message', async () => {
        const {iframe, messenger} = await setupTest();

        const iframeSrcDoc = html`
            <html>
                <!-- intentionally leave out any response scripts -->
                <head></head>
                <body></body>
            </html>
        `;

        iframe.srcdoc = convertTemplateToString(iframeSrcDoc);

        await assertThrows(
            () =>
                messenger.sendMessageToChild({
                    iframeElement: iframe,
                    message: {
                        type: ExampleMessageType.SendScale,
                        data: {
                            width: 11,
                            height: 22,
                        },
                    },
                    maxAttemptCount: 2,
                }),
            {
                matchConstructor: Error,
            },
        );
    });
});
