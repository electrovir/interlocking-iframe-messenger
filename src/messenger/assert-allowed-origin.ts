import {AllowedOrigins, AnyOrigin} from './messenger-inputs';

export function isAllowedOrigin(allowedOrigins: AllowedOrigins, messageEvent: MessageEvent) {
    try {
        assertAllowedOrigin(allowedOrigins, messageEvent);
        return true;
    } catch (error) {
        return false;
    }
}

function assertAllowedOrigin(allowedOrigins: AllowedOrigins, messageEvent: MessageEvent) {
    if (allowedOrigins === AnyOrigin) {
        return;
    }
    const matchedOrigins = allowedOrigins.filter(
        (allowedOrigin) => messageEvent.origin === allowedOrigin,
    );

    if (!matchedOrigins.length) {
        throw new Error(
            `Received message from invalid origin: ${
                messageEvent.origin
            }. Expected '[${allowedOrigins.join(', ')}]'`,
        );
    }
}
