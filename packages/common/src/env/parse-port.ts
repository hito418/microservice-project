export function parsePort(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new Error(`port must be an integer between 1 and 65535, got "${raw}"`);
    }
    return n;
}
