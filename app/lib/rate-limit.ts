
interface RateLimitOptions {
    interval: number; // Window size in milliseconds
    uniqueTokenPerInterval: number; // Max number of unique users/IPs tracked per window
}

export function rateLimit(options: RateLimitOptions) {
    const tokenCache = new Map();

    return {
        check: (limit: number, token: string) =>
            new Promise<void>((resolve, reject) => {
                const now = Date.now();
                const tokenCount = tokenCache.get(token) || [0];

                // tokenCount is [count, startTime]
                if (tokenCount[0] === 0) {
                    tokenCache.set(token, [1, now]);
                    return resolve();
                }

                // If window passed, reset
                if (now - tokenCount[1] > options.interval) {
                    tokenCache.set(token, [1, now]);
                    return resolve();
                }

                // If within window, increment
                tokenCount[0] += 1;

                if (tokenCount[0] > limit) {
                    reject(new Error('Rate limit exceeded'));
                } else {
                    // Update cache
                    tokenCache.set(token, tokenCount);
                    resolve();
                }
            }),
    };
}
