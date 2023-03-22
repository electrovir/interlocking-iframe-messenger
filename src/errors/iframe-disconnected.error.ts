export class IframeDisconnectedError extends Error {
    public override name = 'IframeDisconnectedError';
    constructor() {
        super('Iframe is no longer attached to the DOM.');
    }
}
