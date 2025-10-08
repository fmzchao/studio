import { describe, expect, it } from 'bun:test';

import { ExecutionContext, RunnerConfig } from '../types';
import { runComponentWithRunner } from '../runner';

const createMockContext = () => {
  const logs: string[] = [];
  const progresses: string[] = [];

  const context: ExecutionContext = {
    runId: 'run',
    componentRef: 'component',
    logger: {
      info: (message: unknown) => {
        logs.push(String(message));
      },
      error: () => undefined,
    },
    emitProgress: (message: string) => {
      progresses.push(message);
    },
  };

  return { context, logs, progresses };
};

const execute = async (
  params: { value: number },
  _context: ExecutionContext,
) => {
  return { doubled: params.value * 2 };
};

describe('runComponentWithRunner', () => {
  it('executes components inline', async () => {
    const { context } = createMockContext();

    const result = await runComponentWithRunner(
      { kind: 'inline' },
      execute,
      { value: 2 },
      context,
    );

    expect(result).toEqual({ doubled: 4 });
  });

  it('falls back to inline execution for docker runner stubs', async () => {
    const { context, logs, progresses } = createMockContext();
    const runner: RunnerConfig = {
      kind: 'docker',
      image: 'demo:latest',
      command: ['run'],
    };

    const result = await runComponentWithRunner(
      runner,
      execute,
      { value: 3 },
      context,
    );

    expect(result).toEqual({ doubled: 6 });
    expect(logs.join(' ')).toContain('docker execution stub for image demo:latest');
    expect(progresses[0]).toContain('Docker execution not yet implemented');
  });

  it('falls back to inline execution for remote runner stubs', async () => {
    const { context, logs, progresses } = createMockContext();
    const runner: RunnerConfig = {
      kind: 'remote',
      endpoint: 'https://example.com',
    };

    const result = await runComponentWithRunner(
      runner,
      execute,
      { value: 4 },
      context,
    );

    expect(result).toEqual({ doubled: 8 });
    expect(logs.join(' ')).toContain('remote execution stub for https://example.com');
    expect(progresses[0]).toContain('Remote execution not yet implemented');
  });
});
