import {css, defineElementNoInputs, html, renderIf} from 'element-vir';
import {isChild} from '../../services/env/is-child';
import {VirDemoChild} from './vir-demo-child.element';
import {VirDemoParent} from './vir-demo-parent.element';

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
    renderCallback() {
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
