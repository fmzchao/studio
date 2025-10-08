import { beforeEach, describe, expect, it } from 'bun:test';

import { traceCollector } from '../collector';

describe('traceCollector', () => {
  const runId = 'run-123';

  beforeEach(() => {
    traceCollector.clear();
  });

  it('records and lists events by run id', () => {
    traceCollector.record({
      type: 'NODE_STARTED',
      runId,
      nodeRef: 'node-a',
      timestamp: new Date().toISOString(),
    });

    traceCollector.record({
      type: 'NODE_COMPLETED',
      runId,
      nodeRef: 'node-a',
      timestamp: new Date().toISOString(),
      outputSummary: { ok: true },
    });

    const events = traceCollector.list(runId);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('NODE_STARTED');
    expect(events[1]).toMatchObject({
      type: 'NODE_COMPLETED',
      outputSummary: { ok: true },
    });
  });

  it('clears events for a specific run id', () => {
    traceCollector.record({
      type: 'NODE_STARTED',
      runId,
      nodeRef: 'node-a',
      timestamp: new Date().toISOString(),
    });

    traceCollector.clear(runId);
    expect(traceCollector.list(runId)).toEqual([]);
  });

  it('clears all events when no run id is provided', () => {
    traceCollector.record({
      type: 'NODE_STARTED',
      runId,
      nodeRef: 'node-a',
      timestamp: new Date().toISOString(),
    });

    traceCollector.record({
      type: 'NODE_STARTED',
      runId: 'another-run',
      nodeRef: 'node-b',
      timestamp: new Date().toISOString(),
    });

    traceCollector.clear();

    expect(traceCollector.list(runId)).toEqual([]);
    expect(traceCollector.list('another-run')).toEqual([]);
  });
});
