export type OpenRouterMessageRole = 'system' | 'user' | 'assistant';

export type OpenRouterMessage = {
    role: OpenRouterMessageRole;
    content: string;
};

export type OpenRouterChatCompletionInput = {
    model?: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    maxTokens?: number;
};

export type OpenRouterErrorType =
    | 'missing_api_key'
    | 'invalid_payload'
    | 'timeout'
    | 'network'
    | 'http'
    | 'invalid_json'
    | 'missing_content';

export type OpenRouterChatCompletionResult = {
    content: string;
    model?: string;
    raw?: unknown;
    fallbackUsed: boolean;
    errorType?: OpenRouterErrorType;
    errorMessage?: string;
};

export type OpenRouterConfig = {
    apiKey?: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    maxRetries: number;
    httpReferer?: string;
    appTitle?: string;
};

export type OpenRouterClientOptions = {
    config?: Partial<OpenRouterConfig>;
    fetchFn?: typeof fetch;
    sleepFn?: (ms: number) => Promise<void>;
};

export type OpenRouterClient = {
    createChatCompletion(
        input: OpenRouterChatCompletionInput,
    ): Promise<OpenRouterChatCompletionResult>;
};
