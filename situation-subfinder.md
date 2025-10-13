## ShipSec Studio – Subfinder Component Situation Report _(2025-10-13)_

### TL;DR
- The `shipsec.subfinder.run` component is mid-refactor. Current Docker script now only prints raw subdomain lines; it no longer returns the JSON structure (`subdomains`, `rawOutput`, `domainCount`, `subdomainCount`) that the worker/runtime expects.
- Recent attempts to parse multiple domains and format JSON entirely inside the container became brittle (string escaping, newline handling, lack of `python/jq`). Output keeps degenerating into empty arrays or malformed JSON.
- Workflow runs finish but the Subfinder result object is junk (`{subdomains:[,,,,],rawOutput:...,domainCount:3,...}` or empty arrays). Frontend/backend consumers cannot rely on this payload.

### What Changed
1. **Edge mapping work** (already merged) now pipes outputs correctly between nodes. That part is stable.
2. **Subfinder Docker script refactor** tried to:
   - Accept compact JSON input (`{"domains":[...]}`) and extract domains.
   - Call `subfinder -json` for each domain.
   - Aggregate outputs and escape them to JSON manually.
3. The container lacks helpers (`python`, `jq`), so everything had to be shell/awk/sed. Quoting/escaping became error-prone, especially when combining multiple domains.
4. The last edit (as of now) drastically simplified the script: it just echoes `subfinder -silent` output lines to stdout. JSON aggregation code was dropped, but the TypeScript metadata/schema still expects structured JSON.

### Current File Snapshot
- `worker/src/components/security/subfinder.ts`:
  - `DOMAINS=$(printf "%s" "$INPUT" | tr '\"[],{}' '\n' | ... )`
  - Loops `for DOMAIN in $DOMAINS; do subfinder -silent ... >> $TEMP_FILE`.
  - If results exist, `cat "$TEMP_FILE"` (raw text).
  - **Missing**: JSON wrapping (`subdomains`, `rawOutput`, counts). The returned value is plain text which Nest worker serialises as `{ subfinderActionRef: "<string with newlines>" }`.
  - File also has duplicated closing brackets (`],` repeated) due to earlier partial patching — syntactically still valid TS (because the array literal closes) but style is off.

### Consequences
- Workflow runs no longer fail validation (Zod succeeded because runtime receives strings), but the consumer sees unusable data.
- Anyone downstream expecting `subdomains: string[]` must now parse newline-separated text. The metadata claiming `subdomains` field exists is a lie.
- Tests do not cover the new path:
  - Unit/integration tests for `subfinder` were not updated (they still assert on JSON structure → currently they would fail if re-run).
  - No CI run was performed after the latest script change.

### Recommendations for the Next Agent
1. **Decide on strategy**:
   - _Option A_: Keep JSON contract. Write helper outside the container (worker TS) to parse the raw newline output and construct JSON. This avoids gnarly shell escaping.
   - _Option B_: Restore previous script but fix the JSON escaping bug properly. Consider bundling a lightweight parser (e.g. ship a small Go/Rust binary) or vendor a tiny POSIX-friendly JSON helper into the image.
   - _Option C_: For now, downgrade schema expectations (change `outputSchema` to match raw text) so frontend/backend are consistent. Document that subfinder outputs plain text. 
2. **Fix tests**: whichever approach you choose, update `worker/src/components/security/__tests__/subfinder-integration.test.ts` and unit tests accordingly.
3. **Retest workflow**: run `pm2 restart shipsec-worker --update-env` and re-trigger workflow `f38c93d7-e0fb-47b1-bbfc-fdb6cd19a325` to verify the new output.
4. **Clean up file formatting**: remove duplicated closing brackets and ensure `command: [...]` array is properly indented.
5. **Consider logging**: add debug logs (stderr) or trace events for domain list and subfinder exit codes to help future debugging.

### Useful Notes
- `projectdiscovery/subfinder:latest` currently ships without `python`/`jq`. Only BusyBox tooling + GNU coreutils.
- `subfinder -json -d example.com` writes one JSON object per line; each includes `"host"` and `"source"`. Aggregating these outside the container is easier than shell gymnastics.
- Runtime state also depends on MinIO/Postgres. Ensure the worker uses `shipsec-dev` namespace (`TEMPORAL_NAMESPACE`).

### Suggested Next Steps
1. Pick a contract (structured JSON vs raw text) and implement end-to-end consistently.
2. Run `bun run typecheck` + relevant tests (`worker/src/components/security/__tests__/subfinder-integration.test.ts`).
3. Document the final behaviour back in `.ai/implementation-plan.md` to avoid future confusion.
