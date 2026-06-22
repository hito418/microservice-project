import { describe, expect, it, vi, afterEach } from 'vitest';

import { createOpenRouterClient } from './openrouter';
import type {
    OpenRouterChatCompletionInput,
    OpenRouterConfig,
} from './openrouter.types';

const API_KEY = 'test-openrouter-key';
const DEFAULT_INPUT: OpenRouterChatCompletionInput = {
    messages: [{ role: 'user', content: 'Analyze this debate' }],
};

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('createOpenRouterClient', () => {
    it('builds a valid OpenRouter chat completion request', async () => {
        const fetchFn = mockFetch(validResponse('Analysis complete'));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn).createChatCompletion(
            DEFAULT_INPUT,
        );

        expect(result).toMatchObject({
            content: 'Analysis complete',
            model: 'openai/gpt-4o',
            fallbackUsed: false,
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
            model: 'openai/gpt-4o',
            messages: DEFAULT_INPUT.messages,
        });
    });

    it('adds optional OpenRouter metadata headers when configured', async () => {
        const fetchFn = mockFetch(validResponse('ok'));

        await client(fetchFn, mockSleep(), {
            httpReferer: 'https://ai-debate-arena.test',
            appTitle: 'AI Debate Arena',
        }).createChatCompletion(DEFAULT_INPUT);

        const [, init] = fetchFn.mock.calls[0];
        expect(init?.headers).toMatchObject({
            'HTTP-Referer': 'https://ai-debate-arena.test',
            'X-Title': 'AI Debate Arena',
        });
    });

    it('allows overriding model and generation options per request', async () => {
        const fetchFn = mockFetch(validResponse('ok', 'anthropic/claude'));

        await client(fetchFn).createChatCompletion({
            ...DEFAULT_INPUT,
            model: 'anthropic/claude',
            temperature: 0.2,
            maxTokens: 512,
        });

        const [, init] = fetchFn.mock.calls[0];
        expect(JSON.parse(String(init?.body))).toEqual({
            model: 'anthropic/claude',
            messages: DEFAULT_INPUT.messages,
            temperature: 0.2,
            max_tokens: 512,
        });
    });

    it('uses the configured default model when no request model is provided', async () => {
        const fetchFn = mockFetch(validResponse('ok', 'mistralai/mistral'));

        await client(fetchFn, mockSleep(), {
            model: 'mistralai/mistral',
        }).createChatCompletion(DEFAULT_INPUT);

        const [, init] = fetchFn.mock.calls[0];
        expect(JSON.parse(String(init?.body)).model).toBe('mistralai/mistral');
    });

    it('returns fallback without calling fetch when the API key is missing', async () => {
        const fetchFn = mockFetch(validResponse('ok'));

        const result = await createOpenRouterClient({
            config: { apiKey: '' },
            fetchFn,
            sleepFn: mockSleep(),
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).not.toHaveBeenCalled();
        expect(result).toEqual({
            content: '',
            fallbackUsed: true,
            errorType: 'missing_api_key',
            errorMessage: 'OPENROUTER_API_KEY is required',
        });
        expect(JSON.stringify(result)).not.toContain(API_KEY);
    });

    it('retries 500 responses and returns the later successful response', async () => {
        const fetchFn = mockFetchSequence([
            httpResponse(500, { error: 'server error' }),
            httpResponse(500, { error: 'server error' }),
            validResponse('recovered'),
        ]);
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 2,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(3);
        expect(sleepFn).toHaveBeenNthCalledWith(1, 250);
        expect(sleepFn).toHaveBeenNthCalledWith(2, 500);
        expect(result).toMatchObject({
            content: 'recovered',
            fallbackUsed: false,
        });
    });

    it('retries 429 responses', async () => {
        const fetchFn = mockFetchSequence([
            httpResponse(429, { error: 'rate limit' }),
            validResponse('after retry'),
        ]);
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 1,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepFn).toHaveBeenCalledWith(250);
        expect(result.content).toBe('after retry');
    });

    it('does not retry non-transient 400 responses', async () => {
        const fetchFn = mockFetch(httpResponse(400, { error: 'bad request' }));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 2,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            content: '',
            fallbackUsed: true,
            errorType: 'http',
            errorMessage: 'OpenRouter request failed with HTTP 400',
        });
    });

    it('retries network failures and returns fallback after retries are exhausted', async () => {
        const fetchFn = vi
            .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
            .mockRejectedValue(new TypeError('network down'));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 1,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepFn).toHaveBeenCalledWith(250);
        expect(result).toMatchObject({
            content: '',
            fallbackUsed: true,
            errorType: 'network',
            errorMessage: 'OpenRouter network request failed',
        });
    });

    it('uses AbortController timeout and treats aborts as retryable timeout failures', async () => {
        vi.useFakeTimers();
        const fetchFn = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        reject(abortError());
                    });
                }),
        );

        const promise = client(fetchFn, mockSleep(), {
            timeoutMs: 10,
            maxRetries: 0,
        }).createChatCompletion(DEFAULT_INPUT);

        await vi.advanceTimersByTimeAsync(10);
        const result = await promise;

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            content: '',
            fallbackUsed: true,
            errorType: 'timeout',
            errorMessage: 'OpenRouter request timed out',
        });
    });

    it('does not retry invalid JSON responses', async () => {
        const fetchFn = mockFetch(new Response('not-json', { status: 200 }));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 2,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            content: '',
            fallbackUsed: true,
            errorType: 'invalid_json',
        });
    });

    it('does not retry responses without message content', async () => {
        const fetchFn = mockFetch(httpResponse(200, { choices: [{ message: {} }] }));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 2,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            content: '',
            fallbackUsed: true,
            errorType: 'missing_content',
        });
    });

    it('does not retry invalid request payloads', async () => {
        const fetchFn = mockFetch(validResponse('ok'));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn).createChatCompletion({
            messages: [],
        });

        expect(fetchFn).not.toHaveBeenCalled();
        expect(sleepFn).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            content: '',
            fallbackUsed: true,
            errorType: 'invalid_payload',
        });
    });

    it('respects maxRetries when configured to zero', async () => {
        const fetchFn = mockFetch(httpResponse(500, { error: 'server error' }));
        const sleepFn = mockSleep();

        const result = await client(fetchFn, sleepFn, {
            maxRetries: 0,
        }).createChatCompletion(DEFAULT_INPUT);

        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            fallbackUsed: true,
            errorType: 'http',
        });
    });

    it('does not expose the API key in fallback results', async () => {
        const fetchFn = mockFetch(httpResponse(401, { error: 'unauthorized' }));

        const result = await client(fetchFn).createChatCompletion(DEFAULT_INPUT);

        expect(JSON.stringify(result)).not.toContain(API_KEY);
        expect(result.errorMessage).toBe(
            'OpenRouter request failed with HTTP 401',
        );
    });
});

function client(
    fetchFn: typeof fetch,
    sleepFn = mockSleep(),
    config: Partial<OpenRouterConfig> = {},
) {
    return createOpenRouterClient({
        config: {
            apiKey: API_KEY,
            ...config,
        },
        fetchFn,
        sleepFn,
    });
}

function mockFetch(response: Response) {
    return vi
        .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
        .mockResolvedValue(response);
}

function mockFetchSequence(responses: Response[]) {
    const fetchFn = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
    for (const response of responses) {
        fetchFn.mockResolvedValueOnce(response);
    }
    return fetchFn;
}

function mockSleep() {
    return vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
}

function validResponse(content: string, model = 'openai/gpt-4o'): Response {
    return httpResponse(200, {
        model,
        choices: [{ message: { content } }],
    });
}

function httpResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function abortError(): Error {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return error;
}
