import { z } from 'zod';
import { generateText as generateTextImpl } from 'ai';
import { createGoogleGenerativeAI as createGoogleGenerativeAIImpl } from '@ai-sdk/google';
import {
  componentRegistry,
  ComponentDefinition,
  port,
} from '@shipsec/component-sdk';

// Define types for dependencies to enable dependency injection for testing
export type GenerateTextFn = typeof generateTextImpl;
export type CreateGoogleGenerativeAIFn = typeof createGoogleGenerativeAIImpl;
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_BASE_URL = process.env.GEMINI_BASE_URL ?? '';

const inputSchema = z.object({
  systemPrompt: z
    .string()
    .default('')
    .describe('Optional system instructions sent to the Gemini model.'),
  userPrompt: z
    .string()
    .min(1, 'User prompt cannot be empty')
    .describe('Primary user prompt sent to Gemini.'),
  model: z
    .string()
    .default(DEFAULT_MODEL)
    .describe('Gemini chat model identifier.'),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(DEFAULT_TEMPERATURE)
    .describe('Sampling temperature for the response (0-2).'),
  maxTokens: z
    .number()
    .int()
    .min(1)
    .max(8192)
    .default(DEFAULT_MAX_TOKENS)
    .describe('Maximum number of tokens to generate from Gemini.'),
  apiBaseUrl: z
    .string()
    .default(DEFAULT_BASE_URL)
    .describe('Optional override for the Gemini API base URL.'),
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .describe('Resolved Gemini API key supplied via a Secret Loader node.'),
});

type Input = z.infer<typeof inputSchema>;

type GeminiChatModelConfig = {
  provider: 'gemini';
  modelId: string;
  baseUrl?: string;
};

type Output = {
  responseText: string;
  finishReason: string | null;
  rawResponse: unknown;
  usage?: unknown;
  chatModel: GeminiChatModelConfig;
};

const chatModelOutputSchema = z.object({
  provider: z.literal('gemini'),
  modelId: z.string(),
  baseUrl: z.string().optional(),
});

const outputSchema = z.object({
  responseText: z.string(),
  finishReason: z.string().nullable(),
  rawResponse: z.unknown(),
  usage: z.unknown().optional(),
  chatModel: chatModelOutputSchema,
});

const definition: ComponentDefinition<Input, Output> = {
  id: 'core.gemini.chat',
  label: 'Gemini Chat Completion',
  category: 'ai',
  runner: { kind: 'inline' },
  inputSchema,
  outputSchema,
  docs: 'Executes a one-shot chat completion using the Vercel AI SDK against a Gemini endpoint.',
  metadata: {
    slug: 'gemini-chat-completion',
    version: '1.0.0',
    type: 'process',
    category: 'ai',
    description: 'Send a system + user prompt to a Gemini chat completion API and return the response.',
    icon: 'MessageCircle',
    author: {
      name: 'ShipSecAI',
      type: 'shipsecai',
    },
    inputs: [
      {
        id: 'systemPrompt',
        label: 'System Prompt',
        dataType: port.text(),
        required: false,
        description: 'Optional system instructions that prime the Gemini model.',
      },
      {
        id: 'userPrompt',
        label: 'User Prompt',
        dataType: port.text(),
        required: true,
        description: 'User input that will be sent to Gemini.',
      },
      {
        id: 'apiKey',
        label: 'API Key',
        dataType: port.secret(),
        required: true,
        description: 'Connect the Secret Loader output containing the Gemini API key.',
      },
    ],
    outputs: [
      {
        id: 'responseText',
        label: 'Response Text',
        dataType: port.text(),
        description: 'The assistant response from Gemini.',
      },
      {
        id: 'rawResponse',
        label: 'Raw Response',
        dataType: port.json(),
        description: 'Raw response metadata returned by the Gemini provider for debugging.',
      },
      {
        id: 'usage',
        label: 'Token Usage',
        dataType: port.json(),
        description: 'Token usage metadata returned by the provider, if available.',
      },
      {
        id: 'chatModel',
        label: 'Chat Model Config',
        dataType: port.json(),
        description: 'Configuration object (provider, model, overrides) for wiring into the LangChain Agent node.',
      },
    ],
    parameters: [
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        default: DEFAULT_MODEL,
        description: 'Gemini chat model to invoke.',
        options: [
          { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
          { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest' },
          { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest' },
          { label: 'Gemini 1.5 Flash 8B', value: 'gemini-1.5-flash-8b-latest' },
        ],
      },
      {
        id: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        default: DEFAULT_TEMPERATURE,
        min: 0,
        max: 2,
        description: 'Higher values increase creativity, lower values make output deterministic.',
      },
      {
        id: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        default: DEFAULT_MAX_TOKENS,
        min: 1,
        max: 8192,
        description: 'Maximum number of tokens to request from the model.',
      },
      {
        id: 'apiBaseUrl',
        label: 'API Base URL',
        type: 'text',
        required: false,
        default: DEFAULT_BASE_URL,
        description: 'Override for the Gemini API base URL (leave blank for the default provider URL).',
      },
    ],
  },
  async execute(
    params, 
    context,
    // Optional dependencies for testing - in production these will use the default implementations
    dependencies?: {
      generateText?: GenerateTextFn;
      createGoogleGenerativeAI?: CreateGoogleGenerativeAIFn;
    }
  ) {
    const { systemPrompt, userPrompt, model, temperature, maxTokens, apiBaseUrl, apiKey } = params;

    const resolvedApiKey = apiKey.trim();
    if (!resolvedApiKey) {
      throw new Error('Gemini API key is required but was not provided.');
    }

    const baseUrl = apiBaseUrl?.trim() ? apiBaseUrl.trim() : process.env.GEMINI_BASE_URL;
    const resolvedModel = model.trim();
    const modelIdentifier = resolvedModel.startsWith('models/')
      ? resolvedModel
      : `models/${resolvedModel}`;
    
    // Use injected dependencies or default implementations
    const createGoogleGenerativeAI = dependencies?.createGoogleGenerativeAI ?? createGoogleGenerativeAIImpl;
    const client = createGoogleGenerativeAI({
      apiKey: resolvedApiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    context.logger.info(`[GeminiChat] Calling model ${model}`);
    context.emitProgress('Contacting Gemini chat completion endpoint...');

    const trimmedSystemPrompt = systemPrompt?.trim();

    try {
      const generateText = dependencies?.generateText ?? generateTextImpl;
      const response = await generateText({
        model: client(modelIdentifier),
        prompt: userPrompt,
        system: trimmedSystemPrompt ? trimmedSystemPrompt : undefined,
        temperature,
        maxOutputTokens: maxTokens,
      });
      const responseText = response.text ?? '';
      const finishReason = response.finishReason ?? null;

      context.emitProgress('Received response from Gemini provider');

      const chatModelConfig: GeminiChatModelConfig = {
        provider: 'gemini',
        modelId: model,
        ...(baseUrl ? { baseUrl } : {}),
      };

      return {
        responseText,
        finishReason,
        rawResponse: response.response,
        usage: response.usage,
        chatModel: chatModelConfig,
      };
    } catch (error) {
      context.logger.error('[GeminiChat] Request failed', error);
      throw error;
    }
  },
};

componentRegistry.register(definition);
