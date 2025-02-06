/**
 * Simplified type for a window object with listener capabilities.
 *
 * @category Internal
 */
export type GlobalMessenger = Pick<Window, 'addEventListener' | 'removeEventListener'> & {
    parent: Pick<Window['parent'], 'postMessage'>;
};
