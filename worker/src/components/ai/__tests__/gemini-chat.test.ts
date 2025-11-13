import { describe, it, expect, vi, beforeEach, mock } from 'bun:test';
import '../../index';
import { componentRegistry } from '@shipsec/component-sdk';
import type { ExecutionContext } from '@shipsec/component-sdk';
import { createGoogleGenerativeAI as createGoogleGenerativeAIImpl } from '@ai-sdk/google';
import type { ToolSet, GenerateTextResult } from 'ai';
import type { CreateGoogleGenerativeAIFn, GenerateTextFn } from '../gemini-chat';

type GenerateTextParams = Parameters<GenerateTextFn>[0];

const createGenerateTextResult = (): GenerateTextResult<ToolSet, never> => ({
    content: [],
    text: 'gemini response',
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
    inputTokens: 10,
    outputTokens: 12,
    totalTokens: 22,
  },
  totalUsage: {
    inputTokens: 10,
    outputTokens: 12,
    totalTokens: 22,
  },
  warnings: undefined,
  request: {},
  response: {
    id: 'resp',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    modelId: 'gemini-2.5-flash',
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
const createGeminiMock = mock<CreateGoogleGenerativeAIFn>((options) =>
  createGoogleGenerativeAIImpl(options),
);

beforeEach(() => {
  generateTextCalls = [];
  createGeminiMock.mockClear();
});

import '../gemini-chat';

describe('core.gemini.chat component', () => {
  it('uses provided API key and calls the provider', async () => {
    const definition = componentRegistry.get<any, any>('core.gemini.chat');
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
        systemPrompt: '',
        userPrompt: 'Explain the status.',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 512,
        apiBaseUrl: '',
        apiKey: 'gm-live-api-key',
      },
      context,
      {
        generateText: generateTextMock,
        createGoogleGenerativeAI: createGeminiMock,
      }
    );

    expect(createGeminiMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'gm-live-api-key' }),
    );
    expect(generateTextCalls).toHaveLength(1);
    expect(generateTextCalls[0]).toEqual(
      expect.objectContaining({
        prompt: 'Explain the status.',
        temperature: 0.7,
        maxOutputTokens: 512,
      }),
    );
    expect(result.chatModel).toEqual(
      expect.objectContaining({
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
      }),
    );
  });

  it('throws when API key is empty', async () => {
    const definition = componentRegistry.get<any, any>('core.gemini.chat');
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
          userPrompt: 'Explain the status.',
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          maxTokens: 512,
          apiBaseUrl: '',
          apiKey: '  ',
        },
        context,
        {
          generateText: generateTextMock,
          createGoogleGenerativeAI: createGeminiMock,
        }
      ),
    ).rejects.toThrow(/API key is required/i);
  });
});
