import { describe, it, expect, vi, beforeEach, mock } from 'bun:test';
import '../../index';
import { componentRegistry } from '@shipsec/component-sdk';
import type { ExecutionContext } from '@shipsec/component-sdk';
import { createOpenAI as createOpenAIImpl } from '@ai-sdk/openai';
import type { ToolSet, GenerateTextResult } from 'ai';
import type { CreateOpenAIFn, GenerateTextFn } from '../openai-chat';

type GenerateTextParams = Parameters<GenerateTextFn>[0];

const createGenerateTextResult = (): GenerateTextResult<ToolSet, never> => ({
    content: [],
    text: 'hello world',
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
    inputTokens: 5,
    outputTokens: 7,
    totalTokens: 12,
  },
  totalUsage: {
    inputTokens: 5,
    outputTokens: 7,
    totalTokens: 12,
  },
  warnings: undefined,
  request: {},
  response: {
    id: 'resp',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    modelId: 'gpt-5-mini',
    messages: [],
  },
  output: undefined as never,
    providerMetadata: undefined,
    steps: [],
  experimental_output: undefined as never,
});

let generateTextCalls: GenerateTextParams[] = [];
const generateTextMock = (async (_args: GenerateTextParams) => {
  generateTextCalls.push(_args);
  return createGenerateTextResult();
}) as GenerateTextFn;
const createOpenAIMock = mock<CreateOpenAIFn>((options) => createOpenAIImpl(options));

beforeEach(() => {
  generateTextCalls = [];
  createOpenAIMock.mockClear();
});

describe('core.openai.chat component', () => {
  it('uses the provided API key and calls the provider', async () => {
    const definition = componentRegistry.get<any, any>('core.openai.chat');
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
        systemPrompt: 'system prompt',
        userPrompt: 'Hello?',
        model: 'gpt-5-mini',
        temperature: 0.5,
        maxTokens: 256,
        apiBaseUrl: '',
        apiKey: 'sk-live-from-loader',
      },
      context,
      {
        generateText: generateTextMock,
        createOpenAI: createOpenAIMock,
      }
    );

    expect(createOpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-live-from-loader' }),
    );
    expect(generateTextCalls).toHaveLength(1);
    expect(generateTextCalls[0]).toEqual(
      expect.objectContaining({
        prompt: 'Hello?',
        system: 'system prompt',
        temperature: 0.5,
        maxOutputTokens: 256,
      }),
    );
    expect(result.chatModel).toEqual(
      expect.objectContaining({
        provider: 'openai',
        modelId: 'gpt-5-mini',
      }),
    );
  });

  it('throws when API key string is empty', async () => {
    const definition = componentRegistry.get<any, any>('core.openai.chat');
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
          userPrompt: 'Hello',
          model: 'gpt-5-mini',
          temperature: 0.7,
          maxTokens: 512,
          apiBaseUrl: '',
          apiKey: '   ',
        },
        context,
        {
        generateText: generateTextMock,
        createOpenAI: createOpenAIMock,
      }
      ),
    ).rejects.toThrow(/API key is required/i);
  });
});
