import { z } from 'zod';
import {
  componentRegistry,
  ComponentDefinition,
  port,
  type ComponentRetryPolicy,
  runComponentWithRunner,
  type DockerRunnerConfig,
  ValidationError,
} from '@shipsec/component-sdk';
import { IsolatedContainerVolume } from '../../utils/isolated-volume';

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
  }).default({
    headless: true,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
    screenshotOnStart: false,
    screenshotOnEnd: true,
    screenshotOnError: true,
    fullPageScreenshots: false,
    captureConsole: true,
    captureNetwork: false,
    blockTracking: true,
  }).describe('Browser execution options'),
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
    path: z.string().optional(),
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
// Harness Code (Injected into Docker)
// ============================================================================

const harnessCode = `
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const INPUT = JSON.parse(process.env.SHIPSEC_INPUT || '{}');
const OUTPUT_DIR = '/outputs';

async function run() {
  const results = [];
  const screenshots = [];
  const consoleLogs = [];
  let success = true;

  const streamLog = (level, text) => {
    const timestamp = new Date().toISOString();
    consoleLogs.push({ level, text, timestamp });
    console.log(\`[\${level.toUpperCase()}] \${text}\`);
  };

  const takeScreenshot = async (page, name, fullPage = false) => {
    try {
      const timestamp = new Date().toISOString();
      const filename = \`\${name}-\${Date.now()}.png\`;
      const filepath = path.join(OUTPUT_DIR, filename);
      
      await page.screenshot({
        path: filepath,
        fullPage,
        type: 'png',
      });

      screenshots.push({
        name,
        path: filename,
        timestamp,
      });
    } catch (err) {
      streamLog('warn', \`Failed to capture screenshot \${name}: \${err.message}\`);
    }
  };

  let browser;
  try {
    browser = await chromium.launch({
      headless: INPUT.options?.headless ?? true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      viewport: INPUT.options?.viewport ?? { width: 1280, height: 720 },
      userAgent: INPUT.options?.userAgent,
    });

    const page = await context.newPage();

    if (INPUT.options?.captureConsole) {
      page.on('console', msg => {
        streamLog(msg.type(), msg.text());
      });
    }

    if (INPUT.options?.blockTracking) {
      await page.route('**/*', route => {
        const url = route.request().url();
        const blockedDomains = ['doubleclick.net', 'google-analytics.com', 'googletagmanager.com'];
        if (blockedDomains.some(d => url.includes(d))) route.abort();
        else route.continue();
      });
    }

    if (INPUT.options?.screenshotOnStart) {
      await takeScreenshot(page, '00-start', INPUT.options?.fullPageScreenshots);
    }

    // Execute first navigation
    const startTime = Date.now();
    try {
      await page.goto(INPUT.url, { waitUntil: 'load', timeout: INPUT.options?.timeout ?? 30000 });
      results.push({
        action: 'goto',
        success: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        url: page.url(),
        title: await page.title().catch(() => ''),
      });
    } catch (err) {
       results.push({
        action: 'goto',
        success: false,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: err.message,
        url: INPUT.url,
      });
      throw err;
    }

    // Execute actions
    for (const action of (INPUT.actions || [])) {
      const aStart = Date.now();
      try {
        switch (action.type) {
          case 'goto':
            await page.goto(action.url, { waitUntil: action.waitUntil, timeout: action.timeout ?? INPUT.options?.timeout });
            results.push({ action: 'goto', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, url: page.url() });
            break;
          case 'click':
            if (action.waitForSelector) await page.waitForSelector(action.selector, { timeout: action.timeout ?? INPUT.options?.timeout });
            await page.click(action.selector, { timeout: action.timeout ?? INPUT.options?.timeout });
            results.push({ action: 'click', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector });
            break;
          case 'fill':
            await page.fill(action.selector, action.value, { timeout: action.timeout ?? INPUT.options?.timeout });
            results.push({ action: 'fill', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector });
            break;
          case 'screenshot':
            await takeScreenshot(page, action.name, action.fullPage);
            results.push({ action: 'screenshot', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, name: action.name });
            break;
          case 'getText':
            const text = await page.textContent(action.selector);
            results.push({ action: 'getText', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector, text });
            break;
          case 'getHTML':
            const html = action.selector ? await page.innerHTML(action.selector) : await page.content();
            results.push({ action: 'getHTML', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector, html });
            break;
          case 'waitFor':
            await page.waitForSelector(action.selector, { state: action.state, timeout: action.timeout ?? INPUT.options?.timeout });
            results.push({ action: 'waitFor', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector });
            break;
          case 'evaluate':
            const res = await page.evaluate(action.script);
            results.push({ action: 'evaluate', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, result: res });
            break;
          case 'select':
            await page.selectOption(action.selector, action.value);
            results.push({ action: 'select', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector });
            break;
          case 'hover':
            await page.hover(action.selector, { timeout: action.timeout ?? INPUT.options?.timeout });
            results.push({ action: 'hover', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart, selector: action.selector });
            break;
          case 'scroll':
            if (action.position === 'top') await page.evaluate(() => window.scrollTo(0, 0));
            else if (action.position === 'bottom') await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            else if (action.selector) await page.locator(action.selector).scrollIntoViewIfNeeded();
            results.push({ action: 'scroll', success: true, timestamp: new Date().toISOString(), duration: Date.now() - aStart });
            break;
        }
      } catch (err) {
        results.push({
          action: action.type,
          success: false,
          timestamp: new Date().toISOString(),
          duration: Date.now() - aStart,
          error: err.message,
        });
        throw err;
      }
    }

    if (INPUT.options?.screenshotOnEnd) {
      await takeScreenshot(page, '99-end', INPUT.options?.fullPageScreenshots);
    }

    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => '');

    const output = {
      success: true,
      results,
      screenshots,
      consoleLogs,
      finalUrl,
      pageTitle,
    };

    process.stdout.write('---RESULT_START---' + JSON.stringify(output) + '---RESULT_END---');

  } catch (err) {
    const output = {
       success: false,
       results,
       screenshots,
       consoleLogs,
       error: err.message,
    };
    process.stdout.write('---RESULT_START---' + JSON.stringify(output) + '---RESULT_END---');
    process.exit(0);
  } finally {
    if (browser) await browser.close();
  }
}

run();
`;

// ============================================================================
// Component Definition
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


const definition: ComponentDefinition<Input, Output> = {
  id: 'browser.automation',
  label: 'Browser Automation',
  category: 'security',
  retryPolicy: browserAutomationRetryPolicy,
  runner: {
    kind: 'docker',
    image: 'mcr.microsoft.com/playwright:v1.49.1-focal',
    entrypoint: 'sh',
    command: ['-c', 'node /harness.mjs'],
    network: 'bridge',
    timeoutSeconds: 300,
  },
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
    ],
  },

  async execute(input, context) {
    const tenantId = (context as any).tenantId ?? 'default-tenant';
    const volume = new IsolatedContainerVolume(tenantId, context.runId);

    try {
      context.emitProgress('Preparing browser environment...');
      
      const harnessB64 = Buffer.from(harnessCode).toString('base64');
      const shellCommand = `echo "${harnessB64}" | base64 -d > /harness.mjs && node /harness.mjs`;

      const runnerConfig: DockerRunnerConfig = {
        kind: 'docker',
        image: 'mcr.microsoft.com/playwright:v1.49.1-focal',
        entrypoint: 'sh',
        command: ['-c', shellCommand],
        network: 'bridge',
        env: {
          SHIPSEC_INPUT: JSON.stringify(input),
        },
        volumes: [
          volume.getVolumeConfig('/outputs', false),
        ],
      };

      const raw = await runComponentWithRunner<Input, any>(
        runnerConfig,
        async () => { throw new Error('Docker runner failed'); },
        input,
        context,
      );

      let result: any = {};
      if (typeof raw === 'string') {
        const match = raw.match(/---RESULT_START---([\s\S]*)---RESULT_END---/);
        if (match) {
          result = JSON.parse(match[1].trim());
        }
      }

      const finalScreenshots: any[] = [];
      if (result.screenshots && Array.isArray(result.screenshots) && context.artifacts) {
        context.emitProgress(`Uploading \${result.screenshots.length} screenshots...`);
        
        for (const s of result.screenshots) {
          try {
             const buffer = await volume.readFileFromVolumeAsBuffer(s.path);
             const uploadResult = await context.artifacts.upload({
               name: s.path,
               content: buffer,
               mimeType: 'image/png',
               destinations: ['run'],
               metadata: {
                 componentRef: context.componentRef,
                 timestamp: s.timestamp,
               }
             });

             finalScreenshots.push({
               ...s,
               artifactId: uploadResult.artifactId,
               fileId: uploadResult.fileId,
             });
          } catch (err) {
            context.logger.warn(`Failed to process screenshot \${s.name}: \${err.message}`);
            finalScreenshots.push(s);
          }
        }
      }

      return {
        success: result.success ?? false,
        results: result.results ?? [],
        screenshots: finalScreenshots,
        consoleLogs: result.consoleLogs ?? [],
        finalUrl: result.finalUrl,
        pageTitle: result.pageTitle,
        error: result.error,
      };

    } finally {
      await volume.cleanup();
    }
  },
};

componentRegistry.register(definition);

export { definition };
