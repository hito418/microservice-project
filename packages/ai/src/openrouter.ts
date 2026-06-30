import { resolveOpenRouterConfig } from './openrouter.config';
import type {
    OpenRouterChatCompletionInput,
    OpenRouterChatCompletionResult,
    OpenRouterClient,
    OpenRouterClientOptions,
    OpenRouterConfig,
    OpenRouterErrorType,
} from './openrouter.types';

const CHAT_COMPLETIONS_PATH = '/chat/completions';
const RETRY_DELAYS_MS = [250, 500] as const;

type AttemptFailure = {
    type: OpenRouterErrorType;
    message: string;
    retryable: boolean;
};

export function createOpenRouterClient(
    options: OpenRouterClientOptions = {},
): OpenRouterClient {
    const config = resolveOpenRouterConfig(options.config);
    const fetchFn = options.fetchFn ?? fetch;
    const sleepFn = options.sleepFn ?? defaultSleep;

    return {
        createChatCompletion(input) {
            return createChatCompletion(input, config, fetchFn, sleepFn);
        },
    };
}

async function createChatCompletion(
    input: OpenRouterChatCompletionInput,
    config: OpenRouterConfig,
    fetchFn: typeof fetch,
    sleepFn: (ms: number) => Promise<void>,
): Promise<OpenRouterChatCompletionResult> {
    const payloadValidation = validatePayload(input);
    if (payloadValidation) return fallback(payloadValidation.type, payloadValidation.message);

    if (!config.apiKey) {
        return fallback('missing_api_key', 'OPENROUTER_API_KEY is required');
    }

    const attempts = config.maxRetries + 1;
    let lastFailure: AttemptFailure | undefined;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (attempt > 0) {
            await sleepFn(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) ?? 500);
        }

        const result = await attemptChatCompletion(input, config, fetchFn);
        if ('content' in result) return result;

        lastFailure = result;
        if (!result.retryable) break;
    }

    return fallback(
        lastFailure?.type ?? 'network',
        lastFailure?.message ?? 'OpenRouter request failed',
    );
}

async function attemptChatCompletion(
    input: OpenRouterChatCompletionInput,
    config: OpenRouterConfig,
    fetchFn: typeof fetch,
): Promise<OpenRouterChatCompletionResult | AttemptFailure> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
        const response = await fetchFn(chatCompletionsUrl(config.baseUrl), {
            method: 'POST',
            headers: headers(config),
            body: JSON.stringify(body(input, config)),
            signal: controller.signal,
        });

        if (!response.ok) {
            return {
                type: 'http',
                message: `OpenRouter request failed with HTTP ${response.status}`,
                retryable: response.status === 429 || response.status >= 500,
            };
        }

        const raw = await parseJson(response);
        if (!raw.ok) return raw.failure;

        const content = extractContent(raw.value);
        if (content === undefined) {
            return {
                type: 'missing_content',
                message: 'OpenRouter response did not include message content',
                retryable: false,
            };
        }

        return {
            content,
            model: extractModel(raw.value),
            raw: raw.value,
            fallbackUsed: false,
        };
    } catch (error) {
        if (isAbortError(error)) {
            return {
                type: 'timeout',
                message: 'OpenRouter request timed out',
                retryable: true,
            };
        }
        return {
            type: 'network',
            message: 'OpenRouter network request failed',
            retryable: true,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function validatePayload(input: OpenRouterChatCompletionInput): AttemptFailure | undefined {
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
        return {
            type: 'invalid_payload',
            message: 'OpenRouter messages must contain at least one message',
            retryable: false,
        };
    }

    for (const message of input.messages) {
        if (
            (message.role !== 'system' &&
                message.role !== 'user' &&
                message.role !== 'assistant') ||
            message.content.trim() === ''
        ) {
            return {
                type: 'invalid_payload',
                message: 'OpenRouter messages must have a valid role and non-empty content',
                retryable: false,
            };
        }
    }

    return undefined;
}

function headers(config: OpenRouterConfig): HeadersInit {
    const h: Record<string, string> = {
        Authorization: `Bearer ${config.apiKey ?? ''}`,
        'Content-Type': 'application/json',
    };
    if (config.httpReferer) h['HTTP-Referer'] = config.httpReferer;
    if (config.appTitle) h['X-Title'] = config.appTitle;
    return h;
}

function body(input: OpenRouterChatCompletionInput, config: OpenRouterConfig): {
    model: string;
    messages: OpenRouterChatCompletionInput['messages'];
    temperature?: number;
    max_tokens?: number;
} {
    return {
        model: input.model ?? config.model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
    };
}

function chatCompletionsUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}${CHAT_COMPLETIONS_PATH}`;
}

async function parseJson(
    response: Response,
): Promise<{ ok: true; value: unknown } | { ok: false; failure: AttemptFailure }> {
    try {
        return { ok: true, value: await response.json() };
    } catch {
        return {
            ok: false,
            failure: {
                type: 'invalid_json',
                message: 'OpenRouter response was not valid JSON',
                retryable: false,
            },
        };
    }
}

function extractContent(raw: unknown): string | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const choices = (raw as { choices?: unknown }).choices;
    if (!Array.isArray(choices)) return undefined;
    const first = choices[0];
    if (typeof first !== 'object' || first === null) return undefined;
    const message = (first as { message?: unknown }).message;
    if (typeof message !== 'object' || message === null) return undefined;
    const content = (message as { content?: unknown }).content;
    return typeof content === 'string' ? content : undefined;
}

function extractModel(raw: unknown): string | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const model = (raw as { model?: unknown }).model;
    return typeof model === 'string' ? model : undefined;
}

function fallback(
    errorType: OpenRouterErrorType,
    errorMessage: string,
): OpenRouterChatCompletionResult {
    return {
        content: '',
        fallbackUsed: true,
        errorType,
        errorMessage,
    };
}

function isAbortError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        (error as { name?: unknown }).name === 'AbortError'
    );
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
