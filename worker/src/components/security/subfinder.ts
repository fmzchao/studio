import { z } from 'zod';
import { componentRegistry, ComponentDefinition } from '@shipsec/component-sdk';

const inputSchema = z.object({
  domain: z.string(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  subdomains: string[];
  rawOutput: string;
};

const outputSchema = z.object({
  subdomains: z.array(z.string()),
  rawOutput: z.string(),
});

const definition: ComponentDefinition<Input, Output> = {
  id: 'shipsec.subfinder.run',
  label: 'Subfinder',
  category: 'discovery',
  runner: {
    kind: 'docker',
    image: 'projectdiscovery/subfinder:latest',
    entrypoint: 'sh',
    network: 'bridge', // Needs network access for DNS queries
    command: [
      '-c',
      `INPUT=$(cat)
DOMAIN=$(echo "$INPUT" | awk -F'"' '{for(i=1;i<=NF;i++){if($i=="domain"){print $(i+2)}}}')

if [ -z "$DOMAIN" ]; then
  echo '{"subdomains":[],"rawOutput":""}'
  exit 0
fi

# Run subfinder and capture output
RESULTS=$(subfinder -d "$DOMAIN" -silent 2>&1 | grep -v "INF" | grep -v "subfinder" | grep -v "projectdiscovery" | grep -v "^$" | grep -v "^[[:space:]]*$" | grep -v "^─")

# Check if results are empty
if [ -z "$RESULTS" ]; then
  echo '{"subdomains":[],"rawOutput":""}'
  exit 0
fi

# Build JSON with awk for proper formatting
echo "$RESULTS" | awk '
BEGIN {
  printf "{\\"subdomains\\":["
}
{
  if (NR > 1) printf ","
  gsub(/"/, "\\\\\\"", $0)
  printf "\\""$0"\\""
  raw = raw (NR>1 ? " " : "") $0
}
END {
  gsub(/"/, "\\\\\\"", raw)
  printf "],\\"rawOutput\\":\\""raw"\\"}\\n"
}'`,
    ],
    timeoutSeconds: 120,
    env: {
      HOME: '/root', // subfinder needs a home directory for config
    },
  },
  inputSchema,
  outputSchema,
  docs: 'Runs projectdiscovery/subfinder to discover subdomains for a given domain.',
  async execute(params, context) {
    // This function should never be called when using Docker runner
    // The Docker runner intercepts execution and runs the container directly
    throw new Error('Subfinder should run in Docker, not inline. Runner config may be misconfigured.');
  },
};

componentRegistry.register(definition);

