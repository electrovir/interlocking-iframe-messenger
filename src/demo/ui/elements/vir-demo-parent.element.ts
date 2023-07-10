import {randomString} from '@augment-vir/browser';
import {css, defineElementNoInputs, html, listen, onDomCreated} from 'element-vir';
import {classMap} from 'lit/directives/class-map.js';
import {demoIframeMessenger} from '../../services/demo-iframe-messenger';
import {childMarker} from '../../services/env/is-child';

export const VirDemoParent = defineElementNoInputs({
    tagName: 'vir-demo-parent',
    stateInitStatic: {
        parentString: randomString(),
        fromChildNumber: undefined as number | undefined,
        iframeElement: undefined as HTMLIFrameElement | undefined,
    },
    styles: css`
        :host {
            display: flex;
            max-width: 100%;
            flex-wrap: wrap;
            box-sizing: border-box;
        }

        :host > * {
            width: 50%;
            box-sizing: border-box;
            position: relative;
        }

        iframe {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }

        .disabled {
            pointer-events: none;
            opacity: 0.3;
            border: 1px solid red;
        }
    `,
    renderCallback({state, updateState}) {
        const iframeSrc = `?${childMarker}`;

        const shouldButtonsBeDisabled = !state.iframeElement;

        return html`
            <div>
                <h1>parent</h1>

                <p>current parent string: ${state.parentString}</p>
                <p>current from child number: ${state.fromChildNumber}</p>

                <button
                    ?disabled=${shouldButtonsBeDisabled}
                    class=${classMap({
                        disabled: shouldButtonsBeDisabled,
                    })}
                    ${listen('click', async () => {
                        if (state.iframeElement) {
                            updateState({
                                parentString: randomString(),
                            });

                            await demoIframeMessenger.sendMessageToChild({
                                iframeElement: state.iframeElement,
                                childOrigin: window.location.origin,
                                message: {
                                    type: 'sendStringToChild',
                                    data: state.parentString,
                                },
                            });
                        }
                    })}
                >
                    Send new parent string
                </button>
                <button
                    ?disabled=${shouldButtonsBeDisabled}
                    class=${classMap({
                        disabled: shouldButtonsBeDisabled,
                    })}
                    ${listen('click', async () => {
                        if (state.iframeElement) {
                            updateState({
                                fromChildNumber: (
                                    await demoIframeMessenger.sendMessageToChild({
                                        iframeElement: state.iframeElement,
                                        childOrigin: window.location.origin,
                                        message: {
                                            type: 'requestNumberFromChild',
                                        },
                                        verifyChildData: (data) => {
                                            return typeof data === 'number';
                                        },
                                    })
                                ).data,
                            });
                        }
                    })}
                >
                    Request latest child number
                </button>

                <h2>Testing steps</h2>

                <ol>
                    <li>child number and parent string should initially match for both</li>
                    <li>
                        clicking "Send new parent string" should generate a new string on the parent
                        and also update the child's copy of that string
                    </li>
                    <li>
                        clicking "Regenerate child number" should update the child number in the
                        child iframe
                    </li>
                    <li>
                        clicking "Request latest child number" should update the parent's child
                        number value to match whatever the child currently has
                    </li>
                </ol>
            </div>
            <div>
                <iframe
                    src=${iframeSrc}
                    ${onDomCreated(async (element) => {
                        const iframeElement = element as HTMLIFrameElement;
                        updateState({iframeElement: iframeElement});
                        demoIframeMessenger.sendMessageToChild({
                            iframeElement,
                            childOrigin: window.location.origin,
                            message: {
                                type: 'sendStringToChild',
                                data: state.parentString,
                            },
                        });
                        updateState({
                            fromChildNumber: (
                                await demoIframeMessenger.sendMessageToChild({
                                    iframeElement,
                                    childOrigin: window.location.origin,
                                    message: {
                                        type: 'requestNumberFromChild',
                                    },
                                    verifyChildData: (data) => {
                                        return typeof data === 'number';
                                    },
                                })
                            ).data,
                        });
                    })}
                ></iframe>
            </div>
        `;
    },
});
