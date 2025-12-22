import { describe, expect, it } from 'bun:test';
import { definition } from './logic-script';
import { type ExecutionContext } from '@shipsec/component-sdk';

// Mock context
const mockContext: ExecutionContext = {
  workflowId: 'test-workflow',
  runId: 'test-run',
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  emitProgress: () => {},
};

describe('Logic/Script Component', () => {
  it('executes simple JavaScript math', async () => {
    const result = await definition.execute({
      code: 'return { sum: 1 + 2 };',
      variables: [],
      returns: [{ name: 'sum', type: 'number' }],
    }, mockContext);

    expect(result).toEqual({ sum: 3 });
  });

  it('transpiles and executes TypeScript', async () => {
    // Note: The transpiler runs before execution, stripping types.
    // The QuickJS engine then runs the JS.
    const tsCode = `
      interface Result { msg: string; }
      const calculate = (a: number): Result => {
        return { msg: 'Value is ' + a };
      };
      const res: Result = calculate(10);
      return res;
    `;
    
    const result = await definition.execute({
      code: tsCode,
      variables: [],
      returns: [{ name: 'msg', type: 'string' }],
    }, mockContext);

    expect(result).toEqual({ msg: 'Value is 10' });
  });

  it('accepts input variables and returns outputs', async () => {
    const result = await definition.execute({
      code: `
        return {
          diff: x - y,
          product: x * y
        };
      `,
      variables: [
        { name: 'x', type: 'number' },
        { name: 'y', type: 'number' },
      ],
      returns: [
        { name: 'diff', type: 'number' },
        { name: 'product', type: 'number' },
      ],
      // Input values passed as dynamic params
      x: 10,
      y: 4,
    } as any, mockContext);

    expect(result).toEqual({ diff: 6, product: 40 });
  });

  it('isolates execution from global scope', async () => {
    // Try to access process or require
    // QuickJS environment is standard ES2020, usually lacks node globals unless injected.
    const code = `
      try {
        const fs = require('fs');
        return { accessed: true };
      } catch (e) {
        return { accessed: false, error: e.message };
      }
    `;

    const result = await definition.execute({
      code,
      variables: [],
      returns: [{ name: 'accessed', type: 'boolean' }],
    }, mockContext);

    expect(result.accessed).toBe(false);
  });
  
  it('correctly resolves ports', () => {
    const params = {
        code: '',
        variables: [{ name: 'in1', type: 'string' }],
        returns: [{ name: 'out1', type: 'boolean' }],
    };
    // @ts-ignore
    const ports = definition.resolvePorts(params);
    
    expect(ports.inputs).toHaveLength(1);
    expect(ports.inputs![0].id).toBe('in1');
    expect((ports.inputs![0].dataType as any).name).toBe('text');
    
    expect(ports.outputs).toHaveLength(1);
    expect(ports.outputs![0].id).toBe('out1');
    expect((ports.outputs![0].dataType as any).name).toBe('boolean');
  });

});
