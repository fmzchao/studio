import { beforeEach, describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';

import { WorkflowGraphSchema } from '../dto/workflow-graph.dto';
import '../../components/register-default-components';
import { WorkflowDefinition } from '../../dsl/types';
import { WorkflowRepository } from '../repository/workflow.repository';
import { WorkflowsService } from '../workflows.service';

const sampleGraph = WorkflowGraphSchema.parse({
  name: 'Sample workflow',
  nodes: [
    {
      id: 'trigger',
      type: 'core.trigger.manual',
      label: 'Trigger',
      position: { x: 0, y: 0 },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let createCalls = 0;
  const now = new Date().toISOString();

  const repositoryMock = {
    async create() {
      createCalls += 1;
      return {
        id: 'workflow-id',
        createdAt: now,
        updatedAt: now,
        name: sampleGraph.name,
        description: sampleGraph.description ?? null,
        graph: sampleGraph,
        compiledDefinition: null,
      };
    },
    async update() {
      return {
        id: 'workflow-id',
        createdAt: now,
        updatedAt: now,
        name: sampleGraph.name,
        description: sampleGraph.description ?? null,
        graph: sampleGraph,
        compiledDefinition: null,
      };
    },
    async findById() {
      return {
        id: 'workflow-id',
        createdAt: now,
        updatedAt: now,
        name: sampleGraph.name,
        description: sampleGraph.description ?? null,
        graph: sampleGraph,
        compiledDefinition: null,
      };
    },
    async delete() {
      return;
    },
    async list() {
      return [];
    },
    async saveCompiledDefinition(_: string, definition: WorkflowDefinition) {
      savedDefinition = definition;
      return {
        id: 'workflow-id',
        createdAt: now,
        updatedAt: now,
        name: sampleGraph.name,
        description: sampleGraph.description ?? null,
        graph: sampleGraph,
        compiledDefinition: definition,
      };
    },
  } as unknown as WorkflowRepository;

  let savedDefinition: WorkflowDefinition | null = null;

  beforeEach(async () => {
    createCalls = 0;
    savedDefinition = null;

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        {
          provide: WorkflowRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = moduleRef.get(WorkflowsService);
  });

  it('creates a workflow using the repository', async () => {
    const created = await service.create(sampleGraph);
    expect(created.id).toBe('workflow-id');
    expect(createCalls).toBe(1);
  });

  it('commits a workflow definition', async () => {
    const definition = await service.commit('workflow-id');
    expect(definition.actions.length).toBeGreaterThan(0);
    expect(savedDefinition).toEqual(definition);
  });
});
