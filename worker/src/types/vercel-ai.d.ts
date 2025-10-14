declare module 'ai' {
  export interface GenerateTextResult {
    text: string;
    finishReason?: string | null;
    response: unknown;
    usage?: unknown;
  }

  export interface GenerateTextParams {
    model: unknown;
    prompt: string;
    system?: string;
    temperature?: number;
    maxTokens?: number;
  }

  export function generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
}

declare module '@ai-sdk/openai' {
  export interface OpenAIClientOptions {
    apiKey: string;
    baseURL?: string;
  }

  export type OpenAIModelFactory = (model: string) => unknown;

  export function createOpenAI(options: OpenAIClientOptions): OpenAIModelFactory;
}
