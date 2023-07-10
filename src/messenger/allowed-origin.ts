import {wrapInTry} from '@augment-vir/common';

export function isAllowedOrigin(
    requiredOrigin: string,
    messageEvent: Pick<MessageEvent, 'origin'>,
): boolean {
    return wrapInTry({
        callback() {
            assertAllowedOrigin(requiredOrigin, messageEvent);
            return true;
        },
        fallbackValue: false,
    });
}

export function assertAllowedOrigin(
    requiredOrigin: string,
    messageEvent: Pick<MessageEvent, 'origin'>,
) {
    if (requiredOrigin === '*') {
        console.warn(
            "Security warning: iFrame messenger is allowing messages from any origin with '*'",
        );
    } else if (!requiredOrigin || messageEvent.origin !== requiredOrigin) {
        throw new Error(
            `Received message from invalid origin: ${messageEvent.origin}. Expected '${requiredOrigin}'`,
        );
    }
}
