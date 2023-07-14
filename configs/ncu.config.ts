import {RunOptions} from 'npm-check-updates';

export const ncuConfig: RunOptions = {
    color: true,
    upgrade: true,
    root: true,
    // exclude these
    reject: [
        'prettier',
        '@web/test-runner',
    ],
    // include only these
    filter: [],
};
