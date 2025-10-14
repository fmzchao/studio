import { z } from 'zod';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { componentRegistry, ComponentDefinition } from '@shipsec/component-sdk';

const HARDCODED_API_KEY = 'sk-REPLACE_WITH_REAL_KEY';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? HARDCODED_API_KEY;

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL ?? '';

const inputSchema = z.object({
  systemPrompt: z
    .string()
    .default('')
    .describe('Optional system message to steer the assistant behaviour.'),
  userPrompt: z
    .string()
    .min(1, 'User prompt cannot be empty')
    .describe('Primary user prompt sent to the assistant.'),
  model: z
    .string()
    .default(DEFAULT_MODEL)
    .describe('OpenAI compatible chat model identifier.'),
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
    .max(4096)
    .default(DEFAULT_MAX_TOKENS)
    .describe('Maximum number of tokens to generate in the completion.'),
  apiBaseUrl: z
    .string()
    .default(DEFAULT_BASE_URL)
    .describe('Optional override for the OpenAI-compatible API base URL.'),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  responseText: string;
  finishReason: string | null;
  rawResponse: unknown;
  usage?: unknown;
};

const outputSchema = z.object({
  responseText: z.string(),
  finishReason: z.string().nullable(),
  rawResponse: z.unknown(),
  usage: z.unknown().optional(),
});

const definition: ComponentDefinition<Input, Output> = {
  id: 'core.openai.chat',
  label: 'OpenAI Chat Completion',
  category: 'transform',
  runner: { kind: 'inline' },
  inputSchema,
  outputSchema,
  docs: 'Executes a one-shot chat completion using the Vercel AI SDK against an OpenAI-compatible endpoint.',
  metadata: {
    slug: 'openai-chat-completion',
    version: '1.0.0',
    type: 'process',
    category: 'building-block',
    description:
      'Send a system + user prompt to an OpenAI compatible chat completion API and return the response.',
    icon: 'MessageCircle',
    author: {
      name: 'ShipSecAI',
      type: 'shipsecai',
    },
    inputs: [
      {
        id: 'systemPrompt',
        label: 'System Prompt',
        type: 'string',
        required: false,
        description: 'Optional system message that primes the model.',
      },
      {
        id: 'userPrompt',
        label: 'User Prompt',
        type: 'string',
        required: true,
        description: 'User input that will be sent to the assistant.',
      },
    ],
    outputs: [
      {
        id: 'responseText',
        label: 'Response Text',
        type: 'string',
        description: 'The assistant response from the model.',
      },
      {
        id: 'rawResponse',
        label: 'Raw Response',
        type: 'object',
        description: 'Raw response metadata returned by the provider for debugging.',
      },
      {
        id: 'usage',
        label: 'Token Usage',
        type: 'object',
        description: 'Token usage metadata returned by the provider, if available.',
      },
    ],
    parameters: [
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        default: DEFAULT_MODEL,
        description: 'OpenAI compatible chat model to invoke.',
        options: [
          { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
          { label: 'gpt-4o', value: 'gpt-4o' },
          { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
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
        max: 4096,
        description: 'Maximum number of tokens to request from the model.',
      },
      {
        id: 'apiBaseUrl',
        label: 'API Base URL',
        type: 'string',
        required: false,
        default: DEFAULT_BASE_URL,
        description:
          'Override for the OpenAI-compatible API base URL (leave blank for the default provider URL).',
      },
    ],
  },
  async execute(params, context) {
    const { systemPrompt, userPrompt, model, temperature, maxTokens, apiBaseUrl } = params;

    if (!OPENAI_API_KEY || OPENAI_API_KEY === HARDCODED_API_KEY) {
      throw new Error('OpenAI API key is not configured. Update OPENAI_API_KEY or HARDCODED_API_KEY.');
    }

    const baseURL = apiBaseUrl?.trim() ? apiBaseUrl.trim() : process.env.OPENAI_BASE_URL;
    const client = createOpenAI({
      apiKey: OPENAI_API_KEY,
      ...(baseURL ? { baseURL } : {}),
    });

    context.logger.info(`[OpenAIChat] Calling model ${model}`);
    context.emitProgress('Contacting OpenAI-compatible chat completion endpoint...');

    const trimmedSystemPrompt = systemPrompt?.trim();

    try {
      const result = await generateText({
        model: client(model),
        prompt: userPrompt,
        system: trimmedSystemPrompt ? trimmedSystemPrompt : undefined,
        temperature,
        maxTokens,
      });

      context.emitProgress('Received response from OpenAI-compatible provider');

      return {
        responseText: result.text,
        finishReason: result.finishReason ?? null,
        rawResponse: result.response,
        usage: result.usage,
      };
    } catch (error) {
      context.logger.error('[OpenAIChat] Request failed', error);
      throw error;
    }
  },
};

componentRegistry.register(definition);
