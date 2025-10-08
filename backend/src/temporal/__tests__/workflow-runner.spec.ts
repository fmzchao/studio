import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';

import '../../components/register-default-components';
import { componentRegistry } from '../../components/registry';
import { ExecutionContext } from '../../components/types';
import { traceCollector } from '../../trace/collector';
import { WorkflowDefinition } from '../../dsl/types';
import { executeWorkflow } from '../workflow-runner';

describe('executeWorkflow', () => {
  const failureRunIds: string[] = [];

  beforeEach(() => {
    traceCollector.clear();
    failureRunIds.length = 0;
  });

  beforeAll(() => {
    if (!componentRegistry.get('test.failure.component')) {
      componentRegistry.register({
        id: 'test.failure.component',
        label: 'Failure component',
        category: 'output',
        runner: { kind: 'inline' },
        inputSchema: {
          parse: () => ({}),
        } as any,
        outputSchema: {
          parse: (value: unknown) => value,
        } as any,
        async execute(_params: unknown, context: ExecutionContext) {
          failureRunIds.push(context.runId);
          throw new Error('boom');
        },
      });
    }
  });

  const baseDefinition: WorkflowDefinition = {
    title: 'Valid workflow',
    entrypoint: { ref: 'trigger' },
    actions: [
      {
        ref: 'trigger',
        componentId: 'core.trigger.manual',
        params: {},
        dependsOn: [],
      },
      {
        ref: 'loader',
        componentId: 'core.file.loader',
        params: { fileName: 'input.txt' },
        dependsOn: ['trigger'],
      },
    ],
    config: { environment: 'default', timeoutSeconds: 0 },
  };

  it('executes actions in order and returns outputs', async () => {
    const definition: WorkflowDefinition = {
      ...baseDefinition,
      actions: [
        ...baseDefinition.actions,
        {
          ref: 'webhook',
          componentId: 'core.webhook.post',
          params: {
            url: 'https://example.com',
            payload: { status: 'ok' },
          },
          dependsOn: ['loader'],
        },
      ],
    };

    const result = await executeWorkflow(definition, {
      inputs: { payload: { message: 'hi' } },
    });

    expect(result.runId).toBeDefined();
    expect(result.outputs.trigger).toMatchObject({
      payload: { message: 'hi' },
    });
    expect(result.outputs.loader).toMatchObject({
      fileName: 'input.txt',
      mimeType: 'text/plain',
    });
    expect(result.outputs.webhook).toEqual({ status: 'sent' });

    const events = traceCollector.list(result.runId);
    expect(events.filter((event) => event.type === 'NODE_STARTED')).toHaveLength(3);
    expect(events.filter((event) => event.type === 'NODE_COMPLETED')).toHaveLength(3);
  });

  it('throws when component is not registered', async () => {
    const definition: WorkflowDefinition = {
      ...baseDefinition,
      actions: [
        {
          ref: 'missing',
          componentId: 'component.missing',
          params: {},
          dependsOn: [],
        },
      ],
      entrypoint: { ref: 'missing' },
    };

    await expect(executeWorkflow(definition)).rejects.toThrow(
      'Component not registered: component.missing',
    );
  });

  it('records failure events when component execution throws', async () => {
    const definition: WorkflowDefinition = {
      ...baseDefinition,
      actions: [
        {
          ref: 'failing',
          componentId: 'test.failure.component',
          params: {},
          dependsOn: [],
        },
      ],
      entrypoint: { ref: 'failing' },
    };

    await expect(executeWorkflow(definition)).rejects.toThrow('boom');

    expect(failureRunIds).not.toHaveLength(0);
    const runId = failureRunIds[failureRunIds.length - 1];
    const events = traceCollector.list(runId);
    expect(events.some((event) => event.type === 'NODE_FAILED')).toBe(true);
  });
});
