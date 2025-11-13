#!/usr/bin/env bun

import { componentRegistry, createExecutionContext } from '@shipsec/component-sdk';

async function main() {
  await import('../src/components/index');
  const component = componentRegistry.get('core.gemini.chat');
  if (!component) {
    console.error('Component not found');
    process.exit(1);
  }

  const context = createExecutionContext({
    runId: 'test-run',
    componentRef: 'gemini-test',
  });

  const params = component.inputSchema.parse({
    systemPrompt: 'You are helpful.',
    userPrompt: 'What is 2+2?',
    apiKey: 'AIzaSyArjdbc9tz8EGL94kyDLutWOAhVnzbcnjc',
  });

  const output = await component.execute(params, context);
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
