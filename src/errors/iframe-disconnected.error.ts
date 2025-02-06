/**
 * This error is thrown if an Iframe has been disconnected from the DOM while trying to send a
 * message to it.
 *
 * @category Internal
 */
export class IframeDisconnectedError extends Error {
    public override name = 'IframeDisconnectedError';
    constructor() {
        super('Iframe is no longer attached to the DOM.');
    }
}
