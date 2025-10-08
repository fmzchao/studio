// Minimal test workflow - does nothing except return immediately

export async function testMinimalWorkflow(input: { message: string }) {
  // Just return immediately - no activities, no imports
  return {
    message: `Received: ${input.message}`,
    timestamp: new Date().toISOString(),
  };
}

