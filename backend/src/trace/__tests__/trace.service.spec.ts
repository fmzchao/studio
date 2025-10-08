import { beforeEach, describe, expect, it } from 'bun:test';

import { traceCollector } from '../collector';
import { TraceService } from '../trace.service';

describe('TraceService', () => {
  const service = new TraceService();
  const runId = 'service-run';

  beforeEach(() => {
    traceCollector.clear();
  });

  it('returns events from the collector', () => {
    traceCollector.record({
      type: 'NODE_STARTED',
      runId,
      nodeRef: 'node',
      timestamp: new Date().toISOString(),
    });

    expect(service.list(runId)).toHaveLength(1);
  });
});
