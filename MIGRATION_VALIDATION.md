# Component Migration Example: llm-generate-text

## What Changed

### Before
```ts
const inputSchema = inputs({...});
const parameterSchema = parameters({...});
const outputSchema = outputs({...});

// ❌ Manual type inference
type Input = z.infer<typeof inputSchema>;
type Params = z.infer<typeof parameterSchema>;
type Output = {
  responseText: string;
  finishReason: string | null;
  rawResponse: unknown;
  usage?: unknown;
};

const definition = defineComponent({
  ...
  async execute({ inputs, params }, context, dependencies?: Dependencies) {
    // Types were unknown, no autocomplete
    const { systemPrompt, temperature, maxTokens } = params; // type: any
    const { userPrompt, chatModel, modelApiKey } = inputs; // type: any
    ...
  },
});
```

### After
```ts
const inputSchema = inputs({...});
const parameterSchema = parameters({...});
const outputSchema = outputs({...});

// ✅ No manual types needed!

const definition = defineComponent({
  ...
  async execute({ inputs, params }, context, dependencies?: Dependencies) {
    // Fully typed!
    const { systemPrompt, temperature, maxTokens } = params;
    //    ^? systemPrompt: string
    //    ^? temperature: number
    //    ^? maxTokens: number

    const { userPrompt, chatModel, modelApiKey } = inputs;
    //    ^? userPrompt: string
    //    ^? chatModel: LlmProviderConfig
    //    ^? modelApiKey: string | undefined

    // Return type is also inferred:
    return {
      responseText: result.text,
      finishReason: result.finishReason ?? null,
      rawResponse: result.response,
      usage: result.usage,
    };
    // ^? Type matches outputSchema exactly
  },
});
```

## Validation Steps

### 1. Type Safety
Open the file in VSCode and check:
- ✅ Cursor on `params.systemPrompt` shows type: `string`
- ✅ Cursor on `params.temperature` shows type: `number` with range 0-2
- ✅ Cursor on `params.maxTokens` shows type: `number` with range 1-1000000
- ✅ Cursor on `inputs.userPrompt` shows type: `string`
- ✅ Cursor on `inputs.chatModel` shows type: `LlmProviderConfig`
- ✅ Cursor on `inputs.modelApiKey` shows type: `string | undefined`
- ✅ Return type is correctly inferred to match outputSchema

### 2. Type Errors (Before → After)
**Before**: `params` was `{}`, all properties were `unknown`
```
error TS2339: Property 'systemPrompt' does not exist on type '{}'.
error TS2339: Property 'temperature' does not exist on type '{}'.
error TS2339: Property 'userPrompt' does not exist on type 'unknown'.
```

**After**: All errors resolved, full type safety

### 3. Runtime Validation
```bash
# Should pass with no errors
bun --filter='@shipsec/studio-worker' typecheck
```

### 4. Component Registry
The component is still registered correctly:
```ts
componentRegistry.register(definition);
```

All metadata extraction, validation, and runtime behavior remains unchanged.

## Key Benefits

1. **No Manual Types**: Removed 15+ lines of manual type definitions
2. **Full Autocomplete**: IDE provides accurate suggestions for all inputs/params
3. **Type Safety**: Catch errors at compile time, not runtime
4. **Refactoring**: Rename a port/param and TypeScript finds all usages
5. **Documentation**: Types are self-documenting and always in sync with schemas

## Migration Pattern for Other Components

The pattern is simple:

1. **Keep** the `inputs()`, `outputs()`, `parameters()` calls
2. **Remove** all `type X = z.infer<typeof schema>` lines
3. **Remove** manually defined Output types
4. **Keep** the `defineComponent()` call as-is
5. **Let TypeScript** infer all types automatically

No changes needed to:
- Component logic
- Error handling
- Dependencies injection
- Registry calls
- UI metadata
- Retry policies
