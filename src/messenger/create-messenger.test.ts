import {assertThrows, assertTypeOf, typedAssertInstanceOf} from '@augment-vir/browser-testing';
import {convertTemplateToString} from '@augment-vir/element-vir';
import {assert, html, fixture as renderFixture} from '@open-wc/testing';
import {AllowedOrigins, AnyOrigin, MessageDirectionEnum, createIframeMessenger} from '..';
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
        [MessageDirectionEnum.FromParent]: undefined;
        [MessageDirectionEnum.FromChild]: undefined;
    };
    [ExampleMessageType.SendSize]: {
        [MessageDirectionEnum.FromParent]: undefined;
        [MessageDirectionEnum.FromChild]: Dimensions;
    };
    [ExampleMessageType.SendScale]: {
        [MessageDirectionEnum.FromParent]: Dimensions;
        [MessageDirectionEnum.FromChild]: undefined;
    };
    [ExampleMessageType.SendScalingMethod]: {
        [MessageDirectionEnum.FromParent]: 'pixelated' | 'default';
        [MessageDirectionEnum.FromChild]: undefined;
    };
    [ExampleMessageType.ForceSize]: {
        [MessageDirectionEnum.FromParent]: Dimensions | undefined;
        [MessageDirectionEnum.FromChild]: undefined;
    };
};

describe(createIframeMessenger.name, () => {
    it('has proper type constraints in sendMessageToChild', async () => {
        /**
         * Don't actually call this function, it's being used for type testing purposes and
         * shouldn't actually be called in the tests because they will all error.
         *
         * @deprecated
         */
        async function methodCallTypeTests() {
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
                    verifyChildData: () => {
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
                    verifyChildData: () => {
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
    it('has proper type constraints in listenForParentMessages', async () => {
        /**
         * Don't actually call this function, it's being used for type testing purposes and
         * shouldn't actually be called in the tests because they will all error.
         *
         * @deprecated
         */
        function methodCallTypeTests() {
            const messenger = createIframeMessenger<ExampleMessageData>({allowedOrigins: ['']});
            try {
                // narrows message types by their type property
                messenger.listenForParentMessages((message): any => {
                    if (message.type === ExampleMessageType.ForceSize) {
                        assertTypeOf(message.data).toEqualTypeOf<Dimensions | undefined>();
                    } else if (message.type === ExampleMessageType.Ready) {
                        assertTypeOf(message.data).toEqualTypeOf<undefined>();
                    }
                });

                /**
                 * Fails if the callback doesn't return anything when the message data requires a
                 * response from the child for at least one message type.
                 */
                // @ts-expect-error
                messenger.listenForParentMessages((message) => {});
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
                    timeoutMs: 100,
                }),
            {
                matchConstructor: Error,
            },
        );
    });

    it('fails on invalid origin)', async () => {
        const {iframe, messenger} = await setupTest(['something.com']);

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
                    timeoutMs: 100,
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
                        globalThis.addEventListener('message', (event) => {
                            const message = event.data;
                            if (message.direction === '${MessageDirectionEnum.FromParent}') {
                                globalThis.parent.postMessage({
                                    messageId: message.messageId,
                                    type: message.type,
                                    direction: '${MessageDirectionEnum.FromChild}',
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

        const result: undefined = (
            await messenger.sendMessageToChild({
                iframeElement: iframe,
                message: {
                    type: ExampleMessageType.SendScale,
                    data: {
                        width: 11,
                        height: 22,
                    },
                },
            })
        ).data;

        // undefined because the child responded with undefined as the message data
        assert.isUndefined(result);
    });

    it('tries again if verify data fails at first', async () => {
        const {iframe, messenger} = await setupTest();

        const iframeSrcDoc = html`
            <html>
                <head>
                    <script>
                        globalThis.addEventListener('message', (event) => {
                            const message = event.data;
                            if (message.direction === '${MessageDirectionEnum.FromParent}') {
                                globalThis.parent.postMessage({
                                    messageId: message.messageId,
                                    type: message.type,
                                    direction: '${MessageDirectionEnum.FromChild}',
                                    data: {height: 1, width: 2},
                                });
                            }
                        });
                    </script>
                </head>
                <body></body>
            </html>
        `;

        iframe.srcdoc = convertTemplateToString(iframeSrcDoc);

        let verifyCount = 0;

        const result = await messenger.sendMessageToChild({
            iframeElement: iframe,
            message: {
                type: ExampleMessageType.SendSize,
            },
            verifyChildData() {
                verifyCount++;
                return verifyCount > 2;
            },
        });

        // undefined because the child responded with undefined as the message data
        assert.deepStrictEqual(result.data, {height: 1, width: 2});
    });

    it('fails if the child sends an error', async () => {
        const {iframe, messenger} = await setupTest();

        const iframeSrcDoc = html`
            <html>
                <head>
                    <script>
                        globalThis.addEventListener('message', (event) => {
                            const message = event.data;
                            if (message.direction === '${MessageDirectionEnum.FromParent}') {
                                globalThis.parent.postMessage({
                                    messageId: message.messageId,
                                    type: 'error',
                                    direction: '${MessageDirectionEnum.FromChild}',
                                });
                            }
                        });
                    </script>
                </head>
                <body></body>
            </html>
        `;

        iframe.srcdoc = convertTemplateToString(iframeSrcDoc);

        await assertThrows(
            () =>
                messenger.sendMessageToChild({
                    iframeElement: iframe,
                    message: {
                        type: ExampleMessageType.SendSize,
                    },
                    verifyChildData() {
                        return true;
                    },
                    timeoutMs: 100,
                }),
            {
                matchMessage: 'Child threw an error',
            },
        );
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
                    timeoutMs: 100,
                }),
            {
                matchConstructor: Error,
            },
        );
    });

    it('fails if no iframe is given', async () => {
        const {messenger} = await setupTest();

        await assertThrows(
            () =>
                messenger.sendMessageToChild({
                    iframeElement: undefined as any,
                    message: {
                        type: ExampleMessageType.SendScale,
                        data: {
                            width: 11,
                            height: 22,
                        },
                    },
                    timeoutMs: 100,
                }),
            {
                matchMessage: 'No iframe element was provided',
            },
        );
    });

    it('message from child with srcdoc has same origin as parent', async () => {
        const {iframe, messenger} = await setupTest();

        const iframeSrcDoc = html`
            <html>
                <head>
                    <script>
                        globalThis.addEventListener('message', (event) => {
                            const message = event.data;
                            if (message.direction === '${MessageDirectionEnum.FromParent}') {
                                globalThis.parent.postMessage({
                                    messageId: message.messageId,
                                    type: message.type,
                                    direction: '${MessageDirectionEnum.FromChild}',
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

        const output = await messenger.sendMessageToChild({
            iframeElement: iframe,
            message: {
                type: ExampleMessageType.SendScale,
                data: {
                    width: 11,
                    height: 22,
                },
            },
        });

        assert.include(output.event.origin, 'localhost');
    });
});
