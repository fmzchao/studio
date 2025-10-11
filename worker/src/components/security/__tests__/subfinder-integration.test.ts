/**
 * Integration test for Subfinder component with real Docker execution
 * Requires Docker daemon to be running
 */
import { describe, test, expect, beforeEach } from 'bun:test';
import { componentRegistry } from '@shipsec/component-sdk';
import type { ExecutionContext } from '@shipsec/component-sdk';
import '../subfinder'; // Register the component

describe('Subfinder Integration (Docker)', () => {
  let context: ExecutionContext;
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    context = {
      runId: 'test-run',
      componentRef: 'shipsec.subfinder.run',
      logger: {
        info: (...args: unknown[]) => {
          const msg = args.join(' ');
          logs.push(`INFO: ${msg}`);
          console.log(msg);
        },
        error: (...args: unknown[]) => {
          const msg = args.join(' ');
          logs.push(`ERROR: ${msg}`);
          console.error(msg);
        },
      },
      emitProgress: (message: string) => {
        logs.push(`PROGRESS: ${message}`);
        console.log(`Progress: ${message}`);
      },
    };
  });

  test('should discover subdomains for a known domain using real subfinder', async () => {
    const component = componentRegistry.get('shipsec.subfinder.run');
    expect(component).toBeDefined();

    const params = { domain: 'example.com' };
    
    // Run with the component's runner (Docker)
    const { runComponentWithRunner } = await import('@shipsec/component-sdk');
    const result = await runComponentWithRunner(
      component!.runner,
      component!.execute as any,
      params,
      context,
    ) as { subdomains: string[], rawOutput: string };

    console.log('Subfinder result:', result);

    // Verify output structure
    expect(result).toHaveProperty('subdomains');
    expect(result).toHaveProperty('rawOutput');
    expect(Array.isArray(result.subdomains)).toBe(true);
    
    // Subfinder might find 0 subdomains for example.com (it's protected)
    // but should still return valid structure
    expect(typeof result.rawOutput).toBe('string');

    // Check logs
    expect(logs.some(log => log.includes('subfinder'))).toBe(true);
  }, 120000); // 2 minute timeout for Docker pull + execution

  test('should handle invalid domain gracefully', async () => {
    const component = componentRegistry.get('shipsec.subfinder.run');
    const params = { domain: 'this-domain-definitely-does-not-exist-12345.invalid' };
    
    const { runComponentWithRunner } = await import('@shipsec/component-sdk');
    
    // Subfinder should complete but return empty results
    const result = await runComponentWithRunner(
      component!.runner,
      component!.execute as any,
      params,
      context,
    ) as { subdomains: string[], rawOutput: string };

    expect(result).toHaveProperty('subdomains');
    expect(Array.isArray(result.subdomains)).toBe(true);
  }, 120000);
});

