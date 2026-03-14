import { env } from '../config/env';

export const logger = {
    debug: (...args) => {
        if (!env.isProduction) {
            // Keep debug logs out of production console noise.
            console.debug(...args);
        }
    },
    info: (...args) => {
        if (!env.isProduction) {
            console.info(...args);
        }
    },
    warn: (...args) => {
        console.warn(...args);
    },
    error: (...args) => {
        console.error(...args);
    },
};
