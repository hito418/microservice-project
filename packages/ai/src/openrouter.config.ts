import type { OpenRouterConfig } from './openrouter.types';

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o';
export const OPENROUTER_DEFAULT_TIMEOUT_MS = 30_000;
export const OPENROUTER_DEFAULT_MAX_RETRIES = 2;

export function resolveOpenRouterConfig(
    overrides: Partial<OpenRouterConfig> = {},
    env: NodeJS.ProcessEnv = process.env,
): OpenRouterConfig {
    return {
        apiKey: cleanOptional(overrides.apiKey ?? env.OPENROUTER_API_KEY),
        baseUrl:
            cleanOptional(overrides.baseUrl ?? env.OPENROUTER_BASE_URL) ??
            OPENROUTER_DEFAULT_BASE_URL,
        model:
            cleanOptional(overrides.model ?? env.OPENROUTER_MODEL) ??
            OPENROUTER_DEFAULT_MODEL,
        timeoutMs:
            overrides.timeoutMs ??
            parsePositiveInteger(
                'OPENROUTER_TIMEOUT_MS',
                env.OPENROUTER_TIMEOUT_MS,
                OPENROUTER_DEFAULT_TIMEOUT_MS,
            ),
        maxRetries:
            overrides.maxRetries ??
            parseNonNegativeInteger(
                'OPENROUTER_MAX_RETRIES',
                env.OPENROUTER_MAX_RETRIES,
                OPENROUTER_DEFAULT_MAX_RETRIES,
            ),
        httpReferer: cleanOptional(
            overrides.httpReferer ?? env.OPENROUTER_HTTP_REFERER,
        ),
        appTitle: cleanOptional(overrides.appTitle ?? env.OPENROUTER_APP_TITLE),
    };
}

function cleanOptional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(
    envName: string,
    raw: string | undefined,
    fallback: number,
): number {
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${envName} must be a positive integer`);
    }
    return parsed;
}

function parseNonNegativeInteger(
    envName: string,
    raw: string | undefined,
    fallback: number,
): number {
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${envName} must be a non-negative integer`);
    }
    return parsed;
}
