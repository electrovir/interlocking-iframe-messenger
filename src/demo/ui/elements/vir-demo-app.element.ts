import {css, defineElementNoInputs, html, renderIf} from 'element-vir';
import {isChild} from '../../services/env/is-child.js';
import {VirDemoChild} from './vir-demo-child.element.js';
import {VirDemoParent} from './vir-demo-parent.element.js';

export const VirDemoApp = defineElementNoInputs({
    tagName: 'vir-demo-app',
    styles: css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            padding: 16px;
            font-family: sans-serif;
        }

        ${VirDemoParent} {
            height: 100%;
        }
    `,
    render() {
        return renderIf(
            isChild,
            html`
                <${VirDemoChild}></${VirDemoChild}>
            `,
            html`
                <${VirDemoParent}></${VirDemoParent}>
            `,
        );
    },
});
