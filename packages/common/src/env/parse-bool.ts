export function parseBool(
    envName: string,
    fallback: boolean,
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    const raw = env[envName];
    if (raw === undefined) return fallback;
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return fallback;
}
