import {AllowedOrigins, AnyOrigin} from './messenger-inputs';

export function assertAllowedOrigin(allowedOrigins: AllowedOrigins, messageEvent: MessageEvent) {
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
