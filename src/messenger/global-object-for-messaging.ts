export type GlobalMessenger = Pick<Window, 'addEventListener' | 'removeEventListener'> & {
    parent: Pick<Window['parent'], 'postMessage'>;
};
