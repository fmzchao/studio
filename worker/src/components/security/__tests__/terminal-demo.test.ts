import { describe, it, expect, beforeAll, afterEach, vi } from 'bun:test';
import * as sdk from '@shipsec/component-sdk';
import { componentRegistry } from '../../index';
import type { TerminalDemoInput, TerminalDemoOutput } from '../terminal-demo';

describe('terminal demo component', () => {
  beforeAll(async () => {
    await import('../../index');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers in the component registry', () => {
    const component = componentRegistry.get<TerminalDemoInput, TerminalDemoOutput>(
      'shipsec.security.terminal-demo',
    );
    expect(component).toBeDefined();
    expect(component?.label).toBe('Terminal Stream Demo');
  });

  it('invokes the docker runner to emit PTY-friendly output', async () => {
    const component = componentRegistry.get<TerminalDemoInput, TerminalDemoOutput>(
      'shipsec.security.terminal-demo',
    );
    if (!component) throw new Error('Component not registered');

    const context = sdk.createExecutionContext({
      runId: 'demo-run',
      componentRef: 'terminal-demo',
    });

    const params = component.inputSchema.parse({
      target: 'test.example.com',
      scanType: 'ports',
      items: 5,
    });

    const mockOutput = JSON.stringify({
      target: 'test.example.com',
      scanType: 'ports',
      itemsFound: 5,
      durationMs: 1500,
      rawOutput: 'Security scan completed successfully',
    });

    const spy = vi.spyOn(sdk, 'runComponentWithRunner').mockResolvedValue(mockOutput);

    const result = component.outputSchema.parse(await component.execute(params, context));

    expect(spy).toHaveBeenCalled();
    expect(result.target).toBe('test.example.com');
    expect(result.scanType).toBe('ports');
    expect(result.itemsFound).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.rawOutput).toBeTruthy();
  });
});
