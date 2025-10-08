import { beforeEach, describe, expect, it } from 'bun:test';

import '../../components/register-default-components';
import { TraceService } from '../../trace/trace.service';
import { traceCollector } from '../../trace/collector';
import { WorkflowDefinition } from '../../dsl/types';
import {
  WorkflowGraphDto,
  WorkflowGraphSchema,
} from '../dto/workflow-graph.dto';
import { WorkflowRecord, WorkflowRepository } from '../repository/workflow.repository';
import { WorkflowsService } from '../workflows.service';
import { WorkflowsController } from '../workflows.controller';

const baseGraph: WorkflowGraphDto = WorkflowGraphSchema.parse({
  name: 'Controller workflow',
  description: 'controller test',
  nodes: [
    {
      id: 'trigger',
      type: 'core.trigger.manual',
      label: 'Trigger',
      position: { x: 0, y: 0 },
    },
    {
      id: 'loader',
      type: 'core.file.loader',
      label: 'Loader',
      position: { x: 0, y: 100 },
      config: { fileName: 'controller.txt' },
    },
  ],
  edges: [{ id: 'edge', source: 'trigger', target: 'loader' }],
  viewport: { x: 0, y: 0, zoom: 1 },
});

describe('WorkflowsController', () => {
  let controller: WorkflowsController;
  let repositoryStore: Map<string, WorkflowRecord>;

  beforeEach(() => {
    traceCollector.clear();
    repositoryStore = new Map();

    let compiledSnapshot: WorkflowDefinition | null = null;

    const repositoryStub: Partial<WorkflowRepository> = {
      async create(input) {
        const id = `wf-${repositoryStore.size + 1}`;
        const record: WorkflowRecord = {
          id,
          name: input.name,
          description: input.description ?? null,
          graph: input,
          compiledDefinition: compiledSnapshot,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        repositoryStore.set(id, record);
        return record;
      },
      async update(id, input) {
        const existing = repositoryStore.get(id);
        if (!existing) {
          throw new Error(`Workflow ${id} not found`);
        }
        const updated: WorkflowRecord = {
          ...existing,
          name: input.name,
          description: input.description ?? null,
          graph: input,
          updatedAt: new Date(),
          compiledDefinition: compiledSnapshot,
        };
        repositoryStore.set(id, updated);
        return updated;
      },
      async findById(id) {
        return repositoryStore.get(id);
      },
      async delete(id) {
        repositoryStore.delete(id);
      },
      async list() {
        return Array.from(repositoryStore.values());
      },
      async saveCompiledDefinition(id, definition) {
        const existing = repositoryStore.get(id);
        if (!existing) {
          throw new Error(`Workflow ${id} not found`);
        }
        compiledSnapshot = definition;
        const updated: WorkflowRecord = {
          ...existing,
          compiledDefinition: definition,
          updatedAt: new Date(),
        };
        repositoryStore.set(id, updated);
        return updated;
      },
    };

    const workflowsService = new WorkflowsService(
      repositoryStub as WorkflowRepository,
    );
    const traceService = new TraceService();
    controller = new WorkflowsController(workflowsService, traceService);
  });

  it('creates, lists, updates, and retrieves workflows', async () => {
    const created = await controller.create(baseGraph);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Controller workflow');

    const list = await controller.findAll();
    expect(list).toHaveLength(1);

    const updated = await controller.update(created.id, {
      ...baseGraph,
      name: 'Updated workflow',
    });
    expect(updated.name).toBe('Updated workflow');

    const fetched = await controller.findOne(created.id);
    expect(fetched.id).toBe(created.id);

    const response = await controller.remove(created.id);
    expect(response).toEqual({ status: 'deleted', id: created.id });
  });

  it('commits and runs workflows while exposing traces', async () => {
    const created = await controller.create(baseGraph);

    const definition = await controller.commit(created.id);
    expect(definition.actions).toHaveLength(2);

    const result = await controller.run(created.id, {
      inputs: { payload: { note: 'hello' } },
    });
    expect(result.outputs.trigger).toHaveProperty('payload');
    expect(result.outputs.loader).toHaveProperty('fileName', 'controller.txt');

    const trace = await controller.trace(result.runId);
    expect(trace.runId).toBe(result.runId);
    expect(trace.events.length).toBeGreaterThan(0);
  });
});
