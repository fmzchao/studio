import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportTemplatesService } from './report-templates.service';
import { AiService } from '../ai/ai.service';
import {
  CreateReportTemplateDto,
  ListTemplatesQueryDto,
  TemplateResponseDto,
  UpdateReportTemplateDto,
  GenerateReportDto,
  GenerateReportResponseDto,
  GenerateTemplateDto,
} from './dto/template.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from 'nestjs-zod';
import type { ZodSchema } from 'nestjs-zod';

const CreateReportTemplateSchema: ZodSchema = CreateReportTemplateDto.schema;
const UpdateReportTemplateSchema: ZodSchema = UpdateReportTemplateDto.schema;
const ListTemplatesQuerySchema: ZodSchema = ListTemplatesQueryDto.schema;
const GenerateReportSchema: ZodSchema = GenerateReportDto.schema;
const GenerateTemplateSchema: ZodSchema = GenerateTemplateDto.schema;

@Controller('api/v1/templates')
@UseGuards(AuthGuard)
export class ReportTemplatesController {
  constructor(
    private readonly templatesService: ReportTemplatesService,
    private readonly aiService: AiService,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListTemplatesQuerySchema)) query: ListTemplatesQueryDto,
  ) {
    const templates = await this.templatesService.list({} as any, query);
    return templates.map((t) => TemplateResponseDto.create(t));
  }

  @Get('system')
  async listSystem() {
    const templates = await this.templatesService.listSystemTemplates();
    return templates.map((t) => TemplateResponseDto.create(t));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateReportTemplateSchema)) dto: CreateReportTemplateDto,
  ) {
    const template = await this.templatesService.create({} as any, dto);
    return TemplateResponseDto.create(template);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const template = await this.templatesService.get({} as any, id);
    return TemplateResponseDto.create(template);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateReportTemplateSchema)) dto: UpdateReportTemplateDto,
  ) {
    const template = await this.templatesService.update({} as any, id, dto);
    return TemplateResponseDto.create(template);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.templatesService.delete({} as any, id);
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string) {
    return this.templatesService.getVersions({} as any, id);
  }

  @Post(':id/preview')
  async preview(
    @Param('id') id: string,
    @Body() body: { data: Record<string, unknown> },
  ) {
    const template = await this.templatesService.get({} as any, id);
    return {
      templateId: template.id,
      templateVersion: template.version,
      sampleData: body.data,
      renderedHtml: '',
    };
  }

  @Post('generate')
  async generate(
    @Body(new ZodValidationPipe(GenerateReportSchema)) dto: GenerateReportDto,
  ): Promise<GenerateReportResponseDto> {
    const template = await this.templatesService.get({} as any, dto.templateId);
    return {
      artifactId: '',
      fileName: dto.fileName ?? `report-${Date.now()}.${dto.format}`,
      format: dto.format,
      size: 0,
      templateId: template.id,
      templateVersion: template.version.toString(),
      generatedAt: new Date().toISOString(),
    };
  }

  @Post('ai-generate')
  async aiGenerate(
    @Body(new ZodValidationPipe(GenerateTemplateSchema)) dto: GenerateTemplateDto,
  ) {
    const systemPrompt = dto.systemPrompt || `You are a report template generation expert.
Generate custom HTML templates using our template syntax.

Template Syntax:
- \`{{variable}}\` - Interpolate variables
- \`{{#each items as item}}\` ... \`{{/each}}\` - Loop through arrays
- \`{{#if condition}}\` ... \`{{/if}}\` - Conditional rendering

Return ONLY the template HTML, no explanations.`;

    const result = await this.aiService.generate({
      prompt: dto.prompt,
      systemPrompt,
      mode: 'streaming',
      model: dto.model,
      context: { type: 'template' },
    });

    return result.stream?.toDataStreamResponse();
  }

  @Post('ai-generate-structured')
  async aiGenerateStructured(
    @Body(new ZodValidationPipe(GenerateTemplateSchema)) dto: GenerateTemplateDto,
  ) {
    const result = await this.aiService.generateTemplate(dto.prompt, {
      systemPrompt: dto.systemPrompt,
      model: dto.model,
    });

    return result;
  }
}
