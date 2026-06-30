export function parsePort(
    envName: string,
    fallback: number,
    env: NodeJS.ProcessEnv = process.env,
): number {
    const raw = env[envName];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new Error(`${envName} must be an integer between 1 and 65535, got "${raw}"`);
    }
    return n;
}
