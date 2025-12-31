import { z } from 'zod';
import {
  componentRegistry,
  ComponentDefinition,
  port,
  ValidationError,
  TimeoutError,
  NetworkError,
  ComponentRetryPolicy,
} from '@shipsec/component-sdk';

// ============================================================================
// Action Schemas
// ============================================================================

/**
 * Goto a URL
 */
export const gotoActionSchema = z.object({
  type: z.literal('goto'),
  url: z.string().url('Must be a valid URL'),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle']).default('load'),
  timeout: z.number().int().positive().optional(),
});

/**
 * Click an element
 */
export const clickActionSchema = z.object({
  type: z.literal('click'),
  selector: z.string().min(1, 'Selector is required'),
  waitForSelector: z.boolean().default(true),
  timeout: z.number().int().positive().optional(),
});

/**
 * Fill a form field
 */
export const fillActionSchema = z.object({
  type: z.literal('fill'),
  selector: z.string().min(1, 'Selector is required'),
  value: z.string(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Take a screenshot
 */
export const screenshotActionSchema = z.object({
  type: z.literal('screenshot'),
  name: z.string().optional().default('screenshot'),
  fullPage: z.boolean().default(false),
});

/**
 * Get page HTML
 */
export const getHTMLActionSchema = z.object({
  type: z.literal('getHTML'),
  selector: z.string().optional(),
});

/**
 * Get text content
 */
export const getTextActionSchema = z.object({
  type: z.literal('getText'),
  selector: z.string().min(1, 'Selector is required'),
});

/**
 * Wait for selector
 */
export const waitForActionSchema = z.object({
  type: z.literal('waitFor'),
  selector: z.string().min(1, 'Selector is required'),
  state: z.enum(['attached', 'detached', 'hidden', 'visible']).default('visible'),
  timeout: z.number().int().positive().optional(),
});

/**
 * Evaluate JavaScript
 */
export const evaluateActionSchema = z.object({
  type: z.literal('evaluate'),
  script: z.string().min(1, 'Script is required'),
});

/**
 * Select option from dropdown
 */
export const selectActionSchema = z.object({
  type: z.literal('select'),
  selector: z.string().min(1, 'Selector is required'),
  value: z.string(),
});

/**
 * Hover over element
 */
export const hoverActionSchema = z.object({
  type: z.literal('hover'),
  selector: z.string().min(1, 'Selector is required'),
});

/**
 * Scroll to element or position
 */
export const scrollActionSchema = z.object({
  type: z.literal('scroll'),
  selector: z.string().optional(),
  position: z.enum(['top', 'bottom']).optional(),
});

// Union of all action types
export const browserActionSchema = z.discriminatedUnion('type', [
  gotoActionSchema,
  clickActionSchema,
  fillActionSchema,
  screenshotActionSchema,
  getHTMLActionSchema,
  getTextActionSchema,
  waitForActionSchema,
  evaluateActionSchema,
  selectActionSchema,
  hoverActionSchema,
  scrollActionSchema,
]);

export type BrowserAction = z.infer<typeof browserActionSchema>;

// ============================================================================
// Action Result Schemas
// ============================================================================

export const actionResultBaseSchema = z.object({
  action: z.string(),
  success: z.boolean(),
  timestamp: z.string(),
  duration: z.number(),
  error: z.string().optional(),
});

export const gotoResultSchema = actionResultBaseSchema.extend({
  action: z.literal('goto'),
  url: z.string().optional(),
  title: z.string().optional(),
});

export const clickResultSchema = actionResultBaseSchema.extend({
  action: z.literal('click'),
  selector: z.string().optional(),
});

export const fillResultSchema = actionResultBaseSchema.extend({
  action: z.literal('fill'),
  selector: z.string().optional(),
});

export const screenshotResultSchema = actionResultBaseSchema.extend({
  action: z.literal('screenshot'),
  name: z.string().optional(),
  artifactId: z.string().optional(),
  fileId: z.string().optional(),
  path: z.string().optional(),
});

export const getHTMLResultSchema = actionResultBaseSchema.extend({
  action: z.literal('getHTML'),
  html: z.string().optional(),
  selector: z.string().optional(),
});

export const getTextResultSchema = actionResultBaseSchema.extend({
  action: z.literal('getText'),
  text: z.string().optional(),
  selector: z.string().optional(),
});

export const waitForResultSchema = actionResultBaseSchema.extend({
  action: z.literal('waitFor'),
  selector: z.string().optional(),
});

export const evaluateResultSchema = actionResultBaseSchema.extend({
  action: z.literal('evaluate'),
  result: z.unknown().optional(),
});

export const selectResultSchema = actionResultBaseSchema.extend({
  action: z.literal('select'),
  selector: z.string().optional(),
  value: z.string().optional(),
});

export const hoverResultSchema = actionResultBaseSchema.extend({
  action: z.literal('hover'),
  selector: z.string().optional(),
});

export const scrollResultSchema = actionResultBaseSchema.extend({
  action: z.literal('scroll'),
  selector: z.string().optional(),
  position: z.string().optional(),
});

export const actionResultSchema = z.discriminatedUnion('action', [
  gotoResultSchema,
  clickResultSchema,
  fillResultSchema,
  screenshotResultSchema,
  getHTMLResultSchema,
  getTextResultSchema,
  waitForResultSchema,
  evaluateResultSchema,
  selectResultSchema,
  hoverResultSchema,
  scrollResultSchema,
]);

export type ActionResult = z.infer<typeof actionResultSchema>;

// ============================================================================
// Input/Output Schemas
// ============================================================================

const inputSchema = z.object({
  // Starting URL
  url: z.string().url().describe('Starting URL for the browser session'),

  // Actions to execute
  actions: z.array(browserActionSchema).default([]).describe('Array of browser actions to execute in sequence'),

  // Browser options
  options: z.object({
    headless: z.boolean().default(true).describe('Run headless (no visible UI)'),
    viewport: z.object({
      width: z.number().int().positive().default(1280),
      height: z.number().int().positive().default(720),
    }).default({ width: 1280, height: 720 }).describe('Browser viewport dimensions'),

    timeout: z.number().int().positive().default(30000).describe('Default timeout for actions (ms)'),

    userAgent: z.string().optional().describe('Custom user agent string'),

    // Screenshot options
    screenshotOnStart: z.boolean().default(false).describe('Take screenshot on start'),
    screenshotOnEnd: z.boolean().default(true).describe('Take screenshot on end'),
    screenshotOnError: z.boolean().default(true).describe('Take screenshot on error'),
    fullPageScreenshots: z.boolean().default(false).describe('Capture full page in screenshots'),

    // Console logging
    captureConsole: z.boolean().default(true).describe('Capture browser console logs'),
    captureNetwork: z.boolean().default(false).describe('Capture network requests (experimental)'),

    // Security options
    blockTracking: z.boolean().default(true).describe('Block common tracking scripts'),
  }).default({}).describe('Browser execution options'),
});

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  success: z.boolean().describe('Whether the workflow completed successfully'),
  results: z.array(actionResultSchema).describe('Results of each action executed'),
  screenshots: z.array(z.object({
    name: z.string(),
    artifactId: z.string().optional(),
    fileId: z.string().optional(),
    timestamp: z.string(),
  })).describe('Screenshot artifacts captured'),
  consoleLogs: z.array(z.object({
    level: z.enum(['log', 'warn', 'error', 'debug', 'info']),
    text: z.string(),
    timestamp: z.string(),
  })).describe('Browser console logs captured'),
  finalUrl: z.string().optional().describe('Final URL after all actions'),
  pageTitle: z.string().optional().describe('Page title at end'),
  error: z.string().optional().describe('Error message if workflow failed'),
});

type Output = z.infer<typeof outputSchema>;

// ============================================================================
// Retry Policy
// ============================================================================

const browserAutomationRetryPolicy: ComponentRetryPolicy = {
  maxAttempts: 2,
  initialIntervalSeconds: 2,
  maximumIntervalSeconds: 30,
  backoffCoefficient: 2.0,
  nonRetryableErrorTypes: [
    'ValidationError',
    'ConfigurationError',
  ],
};

// ============================================================================
// Component Definition
// ============================================================================

const definition: ComponentDefinition<Input, Output> = {
  id: 'browser.automation',
  label: 'Browser Automation',
  category: 'security',
  retryPolicy: browserAutomationRetryPolicy,
  runner: { kind: 'inline' },
  inputSchema,
  outputSchema,
  docs: 'Automate browser interactions using Playwright. Supports navigation, clicking, form filling, screenshots, HTML extraction, and JavaScript evaluation. Ideal for web scraping, UI testing, and phishing link investigation.',
  metadata: {
    slug: 'browser-automation',
    version: '1.0.0',
    type: 'scan',
    category: 'security',
    description: 'Automate browser interactions with headless Chrome including screenshots, console logs, and HTML extraction.',
    documentation: 'Uses Playwright to control Chromium. Supports selectors, waits, screenshots, and JavaScript evaluation.',
    documentationUrl: 'https://playwright.dev/docs/api/class-page',
    icon: 'Globe',
    author: {
      name: 'ShipSecAI',
      type: 'shipsecai',
    },
    isLatest: true,
    deprecated: false,
    inputs: [
      {
        id: 'url',
        label: 'Starting URL',
        dataType: port.text(),
        required: true,
        description: 'The initial URL to navigate to.',
      },
      {
        id: 'actions',
        label: 'Actions',
        dataType: port.json(),
        required: false,
        description: 'Array of actions to execute (goto, click, fill, screenshot, etc).',
      },
    ],
    outputs: [
      {
        id: 'results',
        label: 'Action Results',
        dataType: port.json(),
        description: 'Detailed results for each action executed.',
      },
      {
        id: 'screenshots',
        label: 'Screenshots',
        dataType: port.json(),
        description: 'Array of screenshot artifacts with MinIO IDs.',
      },
      {
        id: 'consoleLogs',
        label: 'Console Logs',
        dataType: port.json(),
        description: 'Browser console output captured during execution.',
      },
      {
        id: 'finalUrl',
        label: 'Final URL',
        dataType: port.text(),
        description: 'The URL after all redirects and actions.',
      },
      {
        id: 'pageTitle',
        label: 'Page Title',
        dataType: port.text(),
        description: 'The final page title.',
      },
      {
        id: 'success',
        label: 'Success',
        dataType: port.boolean(),
        description: 'True if all actions completed successfully.',
      },
    ],
    examples: [
      'Visit a URL and take a screenshot for visual verification.',
      'Fill and submit a login form to test credentials.',
      'Scrape product prices from an e-commerce page.',
      'Investigate a suspicious phishing link by capturing screenshots and HTML.',
      'Navigate through a multi-step form flow and capture each step.',
    ],
    parameters: [
      {
        id: 'options.headless',
        label: 'Headless Mode',
        type: 'boolean',
        default: true,
        description: 'Run browser without visible UI. Disable for debugging.',
      },
      {
        id: 'options.viewport',
        label: 'Viewport',
        type: 'json',
        default: { width: 1280, height: 720 },
        description: 'Browser window dimensions.',
      },
      {
        id: 'options.screenshotOnStart',
        label: 'Screenshot on Start',
        type: 'boolean',
        default: false,
        description: 'Capture screenshot before any actions.',
      },
      {
        id: 'options.screenshotOnEnd',
        label: 'Screenshot on End',
        type: 'boolean',
        default: true,
        description: 'Capture screenshot after all actions complete.',
      },
      {
        id: 'options.screenshotOnError',
        label: 'Screenshot on Error',
        type: 'boolean',
        default: true,
        description: 'Capture screenshot when an action fails.',
      },
      {
        id: 'options.captureConsole',
        label: 'Capture Console',
        type: 'boolean',
        default: true,
        description: 'Capture browser console logs (useful for debugging).',
      },
      {
        id: 'options.blockTracking',
        label: 'Block Tracking',
        type: 'boolean',
        default: true,
        description: 'Block common tracking scripts for faster loading.',
      },
      {
        id: 'options.timeout',
        label: 'Timeout (ms)',
        type: 'number',
        default: 30000,
        min: 1000,
        max: 120000,
        description: 'Default timeout for actions.',
      },
    ],
  },

  async execute(input, context) {
    // Lazy load Playwright to avoid unnecessary imports
    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch (error) {
      context.logger.error('[Browser] Playwright not installed. Please run: bun add playwright');
      throw new ValidationError('Playwright is not installed. Add it to worker dependencies.', {
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    const results: ActionResult[] = [];
    const screenshots: Array<{ name: string; artifactId?: string; fileId?: string; timestamp: string }> = [];
    const consoleLogs: Array<{ level: 'log' | 'warn' | 'error' | 'debug' | 'info'; text: string; timestamp: string }> = [];
    let success = true;
    let error: string | undefined;

    // Helper to take screenshot and save as artifact
    const takeScreenshot = async (page: import('playwright').Page, name: string, fullPage = false): Promise<void> => {
      try {
        const timestamp = new Date().toISOString();
        const buffer = await page.screenshot({
          fullPage,
          type: 'png',
        });

        // Save to artifacts if available
        if (context.artifacts) {
          const result = await context.artifacts.upload({
            name: `${name}.png`,
            content: buffer,
            mimeType: 'image/png',
            destinations: ['run'],
            metadata: {
              componentRef: context.componentRef,
              timestamp,
            },
          });

          screenshots.push({
            name,
            artifactId: result.artifactId,
            fileId: result.fileId,
            timestamp,
          });

          context.emitProgress(`Screenshot saved: ${name}.png`);
        } else {
          // Fallback: store in memory without artifact service
          screenshots.push({
            name,
            timestamp,
          });
        }
      } catch (screenshotError) {
        context.logger.warn(`[Browser] Failed to capture screenshot: ${screenshotError}`);
      }
    };

    // Helper to stream console logs to terminal
    const streamConsoleLog = (level: string, ...args: unknown[]) => {
      const timestamp = new Date().toISOString();
      const text = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');

      consoleLogs.push({ level: level as any, text, timestamp });

      // Stream to terminal collector if available
      if (context.terminalCollector) {
        const prefix = level === 'error' ? '[Browser Error]' : level === 'warn' ? '[Browser Warn]' : '[Browser]';
        const message = `${prefix} ${text}\n`;

        // Emit as console stream
        context.terminalCollector({
          runId: context.runId,
          nodeRef: context.componentRef,
          stream: 'console',
          chunkIndex: consoleLogs.length,
          payload: Buffer.from(message).toString('base64'),
          recordedAt: timestamp,
          deltaMs: 0,
          origin: 'browser',
          runnerKind: 'inline',
        });
      }

      context.logger.info(`[Browser Console] [${level}] ${text}`);
    };

    // Helper to execute an action and record result
    const executeAction = async (
      page: import('playwright').Page,
      action: BrowserAction,
    ): Promise<ActionResult> => {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      let result: ActionResult;
      let actionSuccess = true;
      let actionError: string | undefined;

      try {
        context.emitProgress(`Executing: ${action.type}`);

        switch (action.type) {
          case 'goto': {
            const response = await page.goto(action.url, {
              waitUntil: action.waitUntil,
              timeout: action.timeout ?? input.options.timeout,
            });

            result = {
              action: 'goto',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              url: page.url(),
              title: await page.title().catch(() => undefined),
            };

            context.logger.info(`[Browser] Navigated to ${page.url()}`);
            break;
          }

          case 'click': {
            if (action.waitForSelector) {
              await page.waitForSelector(action.selector, { timeout: action.timeout ?? input.options.timeout });
            }
            await page.click(action.selector, { timeout: action.timeout ?? input.options.timeout });

            result = {
              action: 'click',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
            };

            context.logger.info(`[Browser] Clicked: ${action.selector}`);
            break;
          }

          case 'fill': {
            await page.fill(action.selector, action.value, { timeout: action.timeout ?? input.options.timeout });

            result = {
              action: 'fill',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
            };

            context.logger.info(`[Browser] Filled ${action.selector} with ${action.value.slice(0, 20)}...`);
            break;
          }

          case 'screenshot': {
            await takeScreenshot(page, action.name, action.fullPage);

            result = {
              action: 'screenshot',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              name: action.name,
              artifactId: screenshots.find(s => s.name === action.name)?.artifactId,
              fileId: screenshots.find(s => s.name === action.name)?.fileId,
            };
            break;
          }

          case 'getHTML': {
            let html: string | undefined;

            if (action.selector) {
              const element = await page.$(action.selector);
              if (element) {
                html = await element.innerHTML();
              }
            } else {
              html = await page.content();
            }

            result = {
              action: 'getHTML',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              html,
              selector: action.selector,
            };

            context.logger.info(`[Browser] Got HTML (${html?.length ?? 0} chars)`);
            break;
          }

          case 'getText': {
            const text = await page.textContent(action.selector);

            result = {
              action: 'getText',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
              text: text ?? '',
            };

            context.logger.info(`[Browser] Got text: ${text?.slice(0, 50)}...`);
            break;
          }

          case 'waitFor': {
            await page.waitForSelector(action.selector, {
              state: action.state,
              timeout: action.timeout ?? input.options.timeout,
            });

            result = {
              action: 'waitFor',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
            };

            context.logger.info(`[Browser] Waited for ${action.selector} (${action.state})`);
            break;
          }

          case 'evaluate': {
            const evalResult = await page.evaluate(action.script);

            result = {
              action: 'evaluate',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              result: evalResult,
            };

            context.logger.info(`[Browser] Evaluated script`);
            break;
          }

          case 'select': {
            await page.selectOption(action.selector, action.value);

            result = {
              action: 'select',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
              value: action.value,
            };

            context.logger.info(`[Browser] Selected ${action.value} from ${action.selector}`);
            break;
          }

          case 'hover': {
            await page.hover(action.selector, { timeout: action.timeout ?? input.options.timeout });

            result = {
              action: 'hover',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
            };

            context.logger.info(`[Browser] Hovered over ${action.selector}`);
            break;
          }

          case 'scroll': {
            if (action.position === 'top') {
              await page.evaluate(() => window.scrollTo(0, 0));
            } else if (action.position === 'bottom') {
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            } else if (action.selector) {
              await page.locator(action.selector).scrollIntoViewIfNeeded();
            }

            result = {
              action: 'scroll',
              success: true,
              timestamp,
              duration: Date.now() - startTime,
              selector: action.selector,
              position: action.position,
            };

            context.logger.info(`[Browser] Scrolled`);
            break;
          }

          default: {
            const _exhaustive: never = action;
            throw new ValidationError(`Unknown action type: ${(action as any).type}`);
          }
        }
      } catch (err) {
        actionSuccess = false;
        actionError = err instanceof Error ? err.message : String(err);

        result = {
          action: action.type as any,
          success: false,
          timestamp,
          duration: Date.now() - startTime,
          error: actionError,
          ...(action.type === 'goto' ? { url: action.url } : {}),
          ...(action.type === 'click' || action.type === 'fill' || action.type === 'hover' || action.type === 'waitFor'
            ? { selector: action.selector }
            : {}),
          ...(action.type === 'screenshot' ? { name: action.name } : {}),
          ...(action.type === 'select' ? { selector: action.selector, value: action.value } : {}),
        } as ActionResult;

        context.logger.error(`[Browser] Action failed: ${action.type} - ${actionError}`);

        // Take screenshot on error if enabled
        if (input.options.screenshotOnError) {
          await takeScreenshot(page, `error-${action.type}-${Date.now()}`, input.options.fullPageScreenshots);
        }
      }

      return result;
    };

    // Main execution
    let browser: import('playwright').Browser | null = null;
    let page: import('playwright').Page | null = null;

    try {
      context.emitProgress('Launching browser...');

      // Launch browser
      browser = await playwright.chromium.launch({
        headless: input.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      context.emitProgress('Creating page...');

      page = await browser.newPage({
        viewport: input.options.viewport,
        userAgent: input.options.userAgent,
      });

      // Setup console log capture
      if (input.options.captureConsole) {
        page.on('console', msg => {
          streamConsoleLog(msg.type(), msg.text(), msg.args());
        });
      }

      // Block tracking scripts if enabled
      if (input.options.blockTracking) {
        await page.route('**/*', route => {
          const url = route.request().url();
          // Block common tracking domains
          const blockedDomains = [
            'doubleclick.net',
            'google-analytics.com',
            'googletagmanager.com',
            'facebook.com/tr',
            'connect.facebook.net',
            'analytics.twitter.com',
          ];

          const isBlocked = blockedDomains.some(domain => url.includes(domain));

          if (isBlocked) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }

      // Take screenshot on start if enabled
      if (input.options.screenshotOnStart) {
        await takeScreenshot(page, '00-start', input.options.fullPageScreenshots);
      }

      // Navigate to initial URL
      context.emitProgress(`Navigating to ${input.url}...`);
      const gotoResult = await executeAction(page, {
        type: 'goto',
        url: input.url,
        waitUntil: 'load',
      });
      results.push(gotoResult);

      if (!gotoResult.success) {
        throw new Error(`Failed to navigate to ${input.url}: ${gotoResult.error}`);
      }

      // Execute user actions
      for (const action of input.actions) {
        const result = await executeAction(page, action);
        results.push(result);

        if (!result.success) {
          success = false;
          error = `Action ${result.action} failed: ${result.error}`;
          break;
        }
      }

      // Take screenshot on end if enabled
      if (input.options.screenshotOnEnd && success) {
        await takeScreenshot(page, '99-end', input.options.fullPageScreenshots);
      }

      // Get final page info
      const finalUrl = page?.url();
      const pageTitle = await page?.title().catch(() => undefined);

      context.emitProgress('Browser automation completed');

      return {
        success,
        results,
        screenshots,
        consoleLogs,
        finalUrl,
        pageTitle,
        error,
      };

    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);

      context.logger.error(`[Browser] Execution failed: ${error}`);
      context.emitProgress({
        message: `Browser automation failed: ${error}`,
        level: 'error',
      });

      // Take screenshot on error if not already taken
      if (input.options.screenshotOnError && page) {
        await takeScreenshot(page, `error-fatal-${Date.now()}`, input.options.fullPageScreenshots);
      }

      // Return partial results
      return {
        success,
        results,
        screenshots,
        consoleLogs,
        finalUrl: page?.url(),
        pageTitle: await page?.title().catch(() => undefined),
        error,
      };

    } finally {
      // Cleanup
      try {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      } catch (cleanupError) {
        context.logger.warn(`[Browser] Cleanup error: ${cleanupError}`);
      }

      context.emitProgress('Browser closed');
    }
  },
};

componentRegistry.register(definition);

export { definition };
export type { Input as BrowserAutomationInput, Output as BrowserAutomationOutput, BrowserAction, ActionResult };
