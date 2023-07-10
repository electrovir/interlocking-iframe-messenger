import {randomInteger} from '@augment-vir/browser';
import {defineElementNoInputs, html, listen} from 'element-vir';
import {demoIframeMessenger} from '../../services/demo-iframe-messenger';

function createRandomChildNumber() {
    return randomInteger({
        min: 0,
        max: 1_000_000,
    });
}

export const VirDemoChild = defineElementNoInputs({
    tagName: 'vir-demo-child',
    stateInitStatic: {
        fromParentString: '',
        childNumber: createRandomChildNumber(),
    },
    initCallback({state, updateState}) {
        demoIframeMessenger.listenForParentMessages({
            parentOrigin: '',
            listener(message) {
                if (message.type === 'requestNumberFromChild') {
                    return state.childNumber;
                } else if (message.type == 'sendStringToChild') {
                    updateState({fromParentString: message.data});
                }

                return undefined;
            },
        });
    },
    renderCallback({updateState, state}) {
        return html`
            <h1>child</h1>

            <p>current from parent string: ${state.fromParentString}</p>
            <p>current child number: ${state.childNumber}</p>

            <button
                ${listen('click', () => {
                    updateState({childNumber: createRandomChildNumber()});
                })}
            >
                Regenerate child number
            </button>
        `;
    },
});
