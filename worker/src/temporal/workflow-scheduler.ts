import type { WorkflowDefinition } from './types';

export class WorkflowSchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowSchedulerError';
  }
}

export interface WorkflowSchedulerOptions {
  run: (actionRef: string) => Promise<void>;
}

export async function runWorkflowWithScheduler(
  definition: WorkflowDefinition,
  options: WorkflowSchedulerOptions,
): Promise<void> {
  const { run } = options;
  const dependencyCounts = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const action of definition.actions) {
    const initialCount =
      definition.dependencyCounts?.[action.ref] ?? action.dependsOn?.length ?? 0;
    dependencyCounts.set(action.ref, initialCount);

    for (const parent of action.dependsOn ?? []) {
      const list = dependents.get(parent) ?? [];
      list.push(action.ref);
      dependents.set(parent, list);
    }
  }

  const readyQueue: string[] = definition.actions
    .filter((action) => (dependencyCounts.get(action.ref) ?? 0) === 0)
    .map((action) => action.ref);

  const totalActions = definition.actions.length;
  let completedActions = 0;
  const visited = new Set<string>();

  while (completedActions < totalActions) {
    const batch = readyQueue.splice(0);
    if (batch.length === 0) {
      throw new WorkflowSchedulerError(
        'Workflow scheduler deadlock: no ready actions while workflow still incomplete',
      );
    }

    const finishedRefs = await Promise.all(
      batch.map(async (ref) => {
        visited.add(ref);
        await run(ref);
        return ref;
      }),
    );

    for (const ref of finishedRefs) {
      completedActions += 1;
      const downstream = dependents.get(ref) ?? [];
      for (const dependent of downstream) {
        const remaining = (dependencyCounts.get(dependent) ?? 0) - 1;
        dependencyCounts.set(dependent, remaining);
        if (remaining === 0) {
          readyQueue.push(dependent);
        }
      }
    }
  }
}

