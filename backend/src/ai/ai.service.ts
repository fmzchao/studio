import { Injectable, Logger } from '@nestjs/common';
import { 
  streamText, 
  generateText,
  convertToModelMessages,
  tool,
  type UIMessage 
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * AI Service - AI SDK v6 with Tools
 * 
 * Configured with OpenRouter (GLM-4.5-Air Free) for development.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: ReturnType<typeof createOpenAI>;
  private readonly modelName = 'z-ai/glm-4.5-air';

  constructor() {
    this.client = createOpenAI({ 
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    });
    
    this.logger.log(`AI Service initialized with model: ${this.modelName}`);
  }

  /**
   * Get the model instance for a request.
   */
  getModel() {
    return this.client(this.modelName);
  }

  buildSystemPrompt(context?: string): string {
    const prompts: Record<string, string> = {
      template: `You are a report template generation expert for security assessments.
Help users create and modify report templates. Our templates use Preact + HTM (Hyperscript Tagged Markup).

Template Structure Rules:
1. Provide a single JS function named 'Template' that takes 'data' as a prop.
2. Use the 'html' tagged template literal from 'htm/preact'.
3. NO IMPORTS, NO EXPORTS. Assume 'html' and 'h' are globally available.
4. CSS: Use standard 'style' strings or template literals. Avoid passing objects to 'style' unless they are standard JS objects.

Example of a high-quality, styled template:
function Template({ data }) {
  return html\`
    <div style="font-family: sans-serif; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        \${data.title}
      </h1>
      <div style="display: flex; gap: 12px; margin: 16px 0;">
        <span style="background: #f3f4f6; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;">
          Date: \${data.date}
        </span>
      </div>
      <p style="line-height: 1.6; color: #4b5563;">\${data.summary}</p>
      
      <h2 style="font-size: 18px; margin-top: 24px;">Findings</h2>
      <ul style="list-style: none; padding: 0;">
        \${data.findings.map(f => html\`
          <li style="margin-bottom: 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <strong style="display: block; color: \${f.severity === 'High' ? '#dc2626' : '#d97706'}">
              [\${f.severity}] \${f.name}
            </strong>
            <span style="font-size: 14px; color: #6b7280;">\${f.description}</span>
          </li>
        \`)}
      </ul>
    </div>
  \`;
}

CRITICAL: Never do <div \${someString}>. Always use key=\${value} pairs. For example: <div style="padding: 10px"> or <div style=\${\`padding: \${data.pad}px\`}>.

IMPORTANT: When the user asks you to generate or modify a template, you MUST use the update_template tool to output:
1. The JS code for the Preact component.
2. The input schema (JSON Schema) defining what 'data' object the template expects.
3. Sample data that demonstrates how the template works.

Never output raw code in chat messages. Always use the update_template tool.
After using the tool, provide a brief conversational response explaining what you did.`,
      agent: 'You are an AI agent assistant.',
      report: 'You are a security report analyst.',
      general: 'You are a helpful AI assistant.',
    };
    return prompts[context || 'general'] || prompts.general;
  }

  /**
   * Get the tools available for template generation
   */
  getTemplateTools() {
    return {
      update_template: tool({
        description: 'Update the template editor with generated template code (Preact+HTM), input schema, and sample data.',
        inputSchema: z.object({
          template: z.string().describe('The complete JS code for the Preact Template component using html`...` syntax from htm/preact.'),
          inputSchema: z.record(z.string(), z.any()).describe('JSON Schema object defining the data prop the template expects.'),
          sampleData: z.record(z.string(), z.any()).describe('Sample data object matching the schema.'),
          description: z.string().describe('A brief description of what this template does.'),
        }),
        // No execute function - tool invocations are sent to the client
      }),
    };
  }

  /**
   * Stream chat with template tools
   * Takes UIMessage[] directly from useChat
   */
  async streamChat(messages: UIMessage[], options?: { system?: string; model?: string; context?: string }) {
    const modelMessages = await convertToModelMessages(messages);
    
    const tools = options?.context === 'template' ? this.getTemplateTools() : undefined;
    
    return streamText({
      model: this.getModel(),
      system: options?.system || this.buildSystemPrompt(options?.context),
      messages: modelMessages,
      tools,
    });
  }

  /**
   * Generate text (non-streaming)
   */
  async chat(messages: UIMessage[], options?: { system?: string; model?: string }) {
    const result = await generateText({
      model: this.getModel(),
      system: options?.system || 'You are a helpful AI assistant.',
      messages: await convertToModelMessages(messages),
    });
    return result;
  }
}
