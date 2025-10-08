import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { Worker, NativeConnection } from '@temporalio/worker';

import { runWorkflowActivity } from '../activities/run-workflow.activity';

async function main() {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'shipsec-default';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'shipsec-dev';
  const workflowsPath = join(dirname(fileURLToPath(import.meta.url)), '../workflows');

  console.log(`🔌 Connecting to Temporal at ${address}...`);

  // Create connection first
  const connection = await NativeConnection.connect({
    address,
  });

  console.log(`✅ Connected to Temporal`);

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath,
    activities: {
      runWorkflow: runWorkflowActivity,
    },
  });

  console.log(
    `🚛 Temporal worker ready (namespace=${namespace}, taskQueue=${taskQueue}, workflowsPath=${workflowsPath})`,
  );
  console.log(`📡 Polling for tasks on queue: ${taskQueue}`);

  await worker.run();
}

main().catch((error) => {
  console.error('Temporal worker failed', error);
  process.exit(1);
});
