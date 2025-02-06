/* node-coverage disable */

import {setDebugMode} from './debug-mode.js';

/**
 * Call this to enable debug mode.
 *
 * @category Internal
 */
export function setInterlockingIframeMessengerDebugMode(enabled: boolean) {
    setDebugMode(enabled);
}
