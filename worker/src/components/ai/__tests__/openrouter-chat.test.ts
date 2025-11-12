import { describe, it, expect, beforeEach, mock } from 'bun:test';
import '../../index';
import { componentRegistry } from '@shipsec/component-sdk';
import type { ExecutionContext } from '@shipsec/component-sdk';
import { createOpenAI as createOpenAIImpl } from '@ai-sdk/openai';
import type { ToolSet, GenerateTextResult } from 'ai';
import type { CreateOpenAIFn, GenerateTextFn } from '../openrouter-chat';

type GenerateTextParams = Parameters<GenerateTextFn>[0];

const createGenerateTextResult = (): GenerateTextResult<ToolSet, never> => ({
  content: [],
  text: 'openrouter response',
  reasoning: [],
  reasoningText: undefined,
  files: [],
  sources: [],
  toolCalls: [],
  staticToolCalls: [],
  dynamicToolCalls: [],
  toolResults: [],
  staticToolResults: [],
  dynamicToolResults: [],
  finishReason: 'stop',
  usage: {
    inputTokens: 12,
    outputTokens: 18,
    totalTokens: 30,
  },
  totalUsage: {
    inputTokens: 12,
    outputTokens: 18,
    totalTokens: 30,
  },
  warnings: undefined,
  request: {},
  response: {
    id: 'resp',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    modelId: 'openrouter/auto',
    messages: [],
  },
  output: undefined as never,
  providerMetadata: undefined,
  steps: [],
  experimental_output: undefined as never,
});

let generateTextCalls: GenerateTextParams[] = [];
const generateTextMock = (async (args: GenerateTextParams) => {
  generateTextCalls.push(args);
  return createGenerateTextResult();
}) as GenerateTextFn;
const createOpenAIMock = mock<CreateOpenAIFn>((options) => createOpenAIImpl(options));

beforeEach(() => {
  generateTextCalls = [];
  createOpenAIMock.mockClear();
});

describe('core.openrouter.chat component', () => {
  it('uses provided API key, applies headers, and calls the provider', async () => {
    const definition = componentRegistry.get<any, any>('core.openrouter.chat');
    expect(definition).toBeDefined();

    const context: ExecutionContext = {
      runId: 'test-run',
      componentRef: 'node-1',
      logger: { info: mock(() => {}), error: mock(() => {}) },
      emitProgress: mock(() => {}),
      metadata: { runId: 'test-run', componentRef: 'node-1' },
      secrets: undefined,
    };

    const result = await (definition!.execute as any)(
      {
        systemPrompt: 'You are helpful.',
        userPrompt: 'Summarise the finding.',
        model: 'meta-llama/llama-3.1-70b-instruct',
        temperature: 0.6,
        maxTokens: 512,
        apiBaseUrl: 'https://openrouter.example/v1',
        apiKey: 'openrouter-live-key',
        httpReferer: ' https://studio.shipsec.ai/workflows ',
        appTitle: ' ShipSec Studio Automation ',
      },
      context,
      {
        generateText: generateTextMock,
        createOpenAI: createOpenAIMock,
      },
    );

    expect(createOpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'openrouter-live-key',
        baseURL: 'https://openrouter.example/v1',
        headers: {
          'HTTP-Referer': 'https://studio.shipsec.ai/workflows',
          'X-Title': 'ShipSec Studio Automation',
        },
      }),
    );

    expect(generateTextCalls).toHaveLength(1);
    expect(generateTextCalls[0]).toEqual(
      expect.objectContaining({
        prompt: 'Summarise the finding.',
        system: 'You are helpful.',
        temperature: 0.6,
        maxOutputTokens: 512,
      }),
    );

    expect(result.chatModel).toEqual(
      expect.objectContaining({
        provider: 'openrouter',
        modelId: 'meta-llama/llama-3.1-70b-instruct',
        baseUrl: 'https://openrouter.example/v1',
        headers: {
          'HTTP-Referer': 'https://studio.shipsec.ai/workflows',
          'X-Title': 'ShipSec Studio Automation',
        },
      }),
    );
  });

  it('throws when API key is empty', async () => {
    const definition = componentRegistry.get<any, any>('core.openrouter.chat');
    expect(definition).toBeDefined();

    const context: ExecutionContext = {
      runId: 'test-run',
      componentRef: 'node-1',
      logger: { info: mock(() => {}), error: mock(() => {}) },
      emitProgress: mock(() => {}),
      metadata: { runId: 'test-run', componentRef: 'node-1' },
      secrets: undefined,
    };

    await expect(
      (definition!.execute as any)(
        {
          systemPrompt: '',
          userPrompt: 'Summarise the finding.',
          model: 'openrouter/auto',
          temperature: 0.7,
          maxTokens: 512,
          apiBaseUrl: '',
          apiKey: '',
          httpReferer: '',
          appTitle: '',
        },
        context,
        {
          generateText: generateTextMock,
          createOpenAI: createOpenAIMock,
        },
      ),
    ).rejects.toThrow(/API key is required/i);
  });
});
