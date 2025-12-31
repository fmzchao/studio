import { beforeAll, beforeEach, describe, expect, it, mock, vi } from 'bun:test';
import { componentRegistry, createExecutionContext, type IArtifactService } from '@shipsec/component-sdk';
import type { ComponentDefinition } from '@shipsec/component-sdk';
import type { ReportGeneratorInput, ReportGeneratorOutput } from '../report-generator';

describe('core.report.generator component', () => {
  let component: ComponentDefinition<ReportGeneratorInput, ReportGeneratorOutput> | undefined;

  beforeAll(async () => {
    await import('../../index');
    component = componentRegistry.get('core.report.generator');
  });

  describe('component definition', () => {
    it('registers with the expected metadata', () => {
      expect(component).toBeDefined();
      expect(component?.label).toBe('Report Generator');
      expect(component?.metadata?.slug).toBe('report-generator');
      expect(component?.metadata?.version).toBe('1.0.0');
      expect(component?.metadata?.category).toBe('output');
    });

    it('has the correct component ID', () => {
      expect(component?.id).toBe('core.report.generator');
    });

    it('defines input and output ports', () => {
      expect(component?.metadata.inputs).toBeDefined();
      expect(component?.metadata.outputs).toBeDefined();
      expect(component?.metadata.inputs.length).toBeGreaterThan(0);
      expect(component?.metadata.outputs.length).toBeGreaterThan(0);
    });
  });

  describe('input validation', () => {
    it('accepts valid input with minimal required fields', () => {
      const input = {
        template: { id: 'test-template', version: '1.0.0' },
      };

      const result = component?.inputSchema.safeParse(input);
      expect(result?.success).toBe(true);
    });

    it('accepts valid input with full data', () => {
      const input = {
        template: { id: 'pentest-standard', version: '1.2.0' },
        findings: [
          {
            severity: 'critical' as const,
            title: 'SQL Injection',
            description: 'Login form vulnerable to SQL injection',
            cve: 'CVE-2024-1234',
            cvss: 9.8,
            proof: "sqlmap -u https://example.com/login --data='user=admin&pass=test'",
            remediation: 'Use parameterized queries',
            references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
          },
          {
            severity: 'high' as const,
            title: 'XSS in Search',
            description: 'Reflected XSS in search functionality',
          },
        ],
        metadata: {
          clientName: 'Acme Corp',
          date: '2025-01-15',
          reportTitle: 'Penetration Test Report',
        },
        scope: ['https://example.com', '192.168.1.0/24'],
        format: 'pdf' as const,
        fileName: 'acme-pentest-report.pdf',
        includeBranding: true,
      };

      const result = component?.inputSchema.safeParse(input);
      expect(result?.success).toBe(true);
    });

    it('accepts array of scope objects', () => {
      const input = {
        template: { id: 'test' },
        scope: [
          { target: 'https://example.com', type: 'web', description: 'Main website' },
          { target: '192.168.1.0/24', type: 'network', description: 'Internal network' },
        ],
      };

      const result = component?.inputSchema.safeParse(input);
      expect(result?.success).toBe(true);
    });

    it('rejects invalid severity level', () => {
      const input = {
        template: { id: 'test' },
        findings: [
          {
            severity: 'invalid',
            title: 'Test',
            description: 'Test',
          },
        ],
      };

      const result = component?.inputSchema.safeParse(input);
      expect(result?.success).toBe(false);
    });

    it('rejects invalid output format', () => {
      const input = {
        template: { id: 'test' },
        format: 'docx',
      };

      const result = component?.inputSchema.safeParse(input);
      expect(result?.success).toBe(false);
    });

    it('validates finding schema with all optional fields', () => {
      const input = {
        template: { id: 'test' },
        findings: [
          {
            severity: 'medium' as const,
            title: 'Test Finding',
            description: 'Test description',
            cve: 'CVE-2024-9999',
            cvss: 5.5,
            proof: 'Proof of concept',
            remediation: 'Fix it',
            references: ['https://example.com/ref'],
          },
        ],
      };

      const result = component?.inputSchema.safeParse(input);
      expect(result?.success).toBe(true);
    });
  });

  describe('execute', () => {
    let uploadMock: any;
    let artifacts: IArtifactService;
    let context: ReturnType<typeof createExecutionContext>;

    beforeEach(() => {
      uploadMock = vi.fn().mockResolvedValue({
        artifactId: 'artifact-123',
        fileId: 'file-123',
        name: 'report.html',
        destinations: ['run'],
      });

      artifacts = {
        upload: uploadMock,
        download: vi.fn(),
      };

      context = createExecutionContext({
        artifacts,
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
        secrets: {
          get: vi.fn(),
        },
        storage: {
          uploadFile: uploadMock,
          downloadFile: vi.fn(),
        },
      });
    });

    it('generates HTML report with sample data', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test-template', version: '1.0.0' },
        findings: [
          {
            severity: 'critical',
            title: 'SQL Injection',
            description: 'Critical vulnerability found',
            cve: 'CVE-2024-1234',
          },
        ],
        metadata: {
          clientName: 'Test Client',
          date: '2025-01-15',
        },
        scope: ['https://example.com'],
        format: 'html',
        fileName: 'test-report.html',
        includeBranding: true,
      };

      const result = await component.execute(input, context);

      expect(result).toMatchObject({
        artifactId: 'artifact-123',
        fileName: 'test-report.html',
        format: 'html',
        templateId: 'test-template',
        templateVersion: '1.0.0',
        generatedAt: expect.any(String),
      });
      expect(result.size).toBeGreaterThan(0);

      expect(uploadMock).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          filename: 'test-report.html',
          mimeType: 'text/html',
          metadata: expect.objectContaining({
            templateId: 'test-template',
            format: 'html',
            findingsCount: 1,
          }),
        })
      );
    });

    it('handles empty findings array', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        findings: [],
        format: 'html',
        fileName: 'empty-report.html',
      };

      const result = await component.execute(input, context);

      expect(result?.artifactId).toBe('artifact-123');
      expect(uploadMock).toHaveBeenCalled();
    });

    it('handles PDF format (warning, pending Puppeteer integration)', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        findings: [{ severity: 'high', title: 'Test', description: 'Test' }],
        format: 'pdf',
        fileName: 'report.pdf',
      };

      const result = await component.execute(input, context);

      // Should still generate an artifact (HTML for now, until Puppeteer is integrated)
      expect(result?.artifactId).toBe('artifact-123');
      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('PDF generation pending')
      );
    });

    it('includes additional data in report', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        additionalData: {
          customSection: 'Custom data',
          executiveSummary: 'This is a custom summary',
        },
        format: 'html',
        fileName: 'custom-report.html',
      };

      const result = await component.execute(input, context);

      expect(result?.artifactId).toBe('artifact-123');
    });

    it('generates proper severity counts in report', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        findings: [
          { severity: 'critical', title: 'C1', description: '' },
          { severity: 'critical', title: 'C2', description: '' },
          { severity: 'high', title: 'H1', description: '' },
          { severity: 'medium', title: 'M1', description: '' },
          { severity: 'low', title: 'L1', description: '' },
          { severity: 'info', title: 'I1', description: '' },
        ],
        format: 'html',
        fileName: 'severity-report.html',
      };

      const result = await component.execute(input, context);

      expect(result?.artifactId).toBe('artifact-123');

      // Verify the upload was called with a buffer containing the severity counts
      const uploadCall = uploadMock.mock.calls[0];
      const htmlBuffer = uploadCall[0] as Buffer;
      const html = htmlBuffer.toString('utf-8');

      expect(html).toContain('2'); // Critical count
      expect(html).toContain('critical');
    });

    it('includes scope in generated report', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        findings: [],
        scope: [
          'https://example.com',
          { target: '192.168.1.0/24', type: 'network', description: 'Internal network' },
        ],
        format: 'html',
        fileName: 'scope-report.html',
      };

      const result = await component.execute(input, context);

      expect(result?.artifactId).toBe('artifact-123');

      const uploadCall = uploadMock.mock.calls[0];
      const htmlBuffer = uploadCall[0] as Buffer;
      const html = htmlBuffer.toString('utf-8');

      expect(html).toContain('https://example.com');
      expect(html).toContain('192.168.1.0/24');
      expect(html).toContain('network');
      expect(html).toContain('Internal network');
    });

    it('includes ShipSec branding when includeBranding is true', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        findings: [],
        format: 'html',
        fileName: 'branded-report.html',
        includeBranding: true,
      };

      const result = await component.execute(input, context);

      const uploadCall = uploadMock.mock.calls[0];
      const htmlBuffer = uploadCall[0] as Buffer;
      const html = htmlBuffer.toString('utf-8');

      expect(html).toContain('ShipSec Studio');
      expect(html).toContain('Generated by ShipSec Studio');
    });

    it('generates valid HTML structure', async () => {
      if (!component) throw new Error('Component not registered');

      const input: ReportGeneratorInput = {
        template: { id: 'test' },
        findings: [{ severity: 'low', title: 'Test', description: 'Test finding' }],
        metadata: { clientName: 'Test Corp', reportTitle: 'Test Report' },
        scope: ['https://test.com'],
        format: 'html',
        fileName: 'valid-html.html',
      };

      const result = await component.execute(input, context);

      const uploadCall = uploadMock.mock.calls[0];
      const htmlBuffer = uploadCall[0] as Buffer;
      const html = htmlBuffer.toString('utf-8');

      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('Test Report');
      expect(html).toContain('Test Corp');
      expect(html).toContain('Test finding');
    });
  });

  describe('exports', () => {
    it('exports SEVERITY_COLORS', async () => {
      const { SEVERITY_COLORS } = await import('../report-generator');

      expect(SEVERITY_COLORS).toBeDefined();
      expect(SEVERITY_COLORS.critical).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(SEVERITY_COLORS.high).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(SEVERITY_COLORS.medium).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(SEVERITY_COLORS.low).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(SEVERITY_COLORS.info).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('exports SHIPSEC_BRANDING', async () => {
      const { SHIPSEC_BRANDING } = await import('../report-generator');

      expect(SHIPSEC_BRANDING).toBeDefined();
      expect(SHIPSEC_BRANDING.header).toContain('ShipSec Studio');
      expect(SHIPSEC_BRANDING.footer).toContain('Confidential');
    });

    it('exports getDefaultReportHTML function', async () => {
      const { getDefaultReportHTML } = await import('../report-generator');

      expect(getDefaultReportHTML).toBeInstanceOf(Function);

      const html = getDefaultReportHTML({
        findings: [],
        metadata: {},
        scope: [],
      });

      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
    });
  });
});
