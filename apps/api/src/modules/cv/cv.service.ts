import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CvExtraction, CvFile } from '@osh/contracts';
import { CV_MAX_BYTES, CvExtractionSchema } from '@osh/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { QueueService, QUEUES } from '../../infra/queue.service';
import { AppError } from '../../common/errors';
import { AiUsageService } from '../ai/ai-usage.service';
import { GeminiService } from '../ai/gemini.service';
import { GuardrailService } from '../ai/guardrail.service';
import { AI_FEATURE, CV_SYSTEM, cvPrompt } from '../ai/prompts';
import { isAiLimitError } from '../ai/limits';
import { parseJsonObject } from '../ai/json';
import { parseCvText } from './cv.parser';

const CV_LIMIT_MB = Math.round(CV_MAX_BYTES / (1024 * 1024));

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly aiUsage: AiUsageService,
    private readonly gemini: GeminiService,
    private readonly guardrail: GuardrailService,
  ) {}

  async upload(userId: string, file: Express.Multer.File): Promise<CvFile> {
    if (!file || !file.buffer || file.size === 0) {
      throw new AppError('EMPTY_FILE', 'Choose a CV file', 400);
    }
    if (file.size > CV_MAX_BYTES) {
      throw new AppError('FILE_TOO_LARGE', `The CV must be ${CV_LIMIT_MB} MB or smaller`, 413);
    }
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    const mime =
      file.mimetype === 'application/octet-stream'
        ? extension === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : file.mimetype;
    if (!['pdf', 'docx'].includes(extension)) {
      throw new AppError('INVALID_FILE_TYPE', 'Only PDF and DOCX are supported', 400);
    }
    if (mime !== 'application/pdf' && mime !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      throw new AppError('INVALID_FILE_TYPE', 'Only PDF and DOCX are supported', 400);
    }
    const isPdf = file.buffer.subarray(0, 4).toString('ascii') === '%PDF';
    const isZip = file.buffer.subarray(0, 2).toString('ascii') === 'PK';
    if ((extension === 'pdf' && !isPdf) || (extension === 'docx' && !isZip)) {
      throw new AppError('INVALID_FILE_TYPE', 'The file content does not match its extension', 400);
    }

    const storagePath = `${userId}/${randomUUID()}.${extension}`;
    await this.storage.upload(storagePath, file.buffer, mime);
    const previous = await this.prisma.cvFile.findMany({ where: { userId }, select: { id: true, storagePath: true } });
    const created = await this.prisma.cvFile.create({
      data: {
        userId,
        storagePath,
        fileName: file.originalname.slice(0, 180),
        mimeType: mime,
        size: file.size,
        status: 'PENDING',
      },
    });
    if (previous.length > 0) {
      await this.prisma.cvFile.deleteMany({
        where: { userId, id: { in: previous.map((row) => row.id) } },
      });
      for (const row of previous) await this.storage.remove(row.storagePath).catch(() => undefined);
    }
    const queued = await this.queue.add(
      QUEUES.cv,
      { fileId: created.id },
      `cv:${created.id}`,
    );
    if (!queued) {
      await this.prisma.cvFile.update({
        where: { id: created.id },
        data: { status: 'FAILED', error: 'Background processing is unavailable. Retry shortly.' },
      });
    }
    return this.toDto(created);
  }

  async latest(userId: string): Promise<CvFile | null> {
    const file = await this.prisma.cvFile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return file ? this.toDto(file) : null;
  }

  async retry(userId: string, fileId: string): Promise<CvFile> {
    const file = await this.prisma.cvFile.findFirst({ where: { id: fileId, userId } });
    if (!file) throw AppError.notFound('CV not found');
    if (file.status === 'COMPLETED') return this.toDto(file);
    await this.prisma.cvFile.update({
      where: { id: file.id },
      data: { status: 'PENDING', error: null },
    });
    await this.queue.addOrFail(QUEUES.cv, { fileId: file.id }, `cv:${file.id}:${Date.now()}`);
    return this.toDto(await this.prisma.cvFile.findUniqueOrThrow({ where: { id: file.id } }));
  }

  async process(fileId: string): Promise<void> {
    const file = await this.prisma.cvFile.findUnique({ where: { id: fileId } });
    if (!file || file.status === 'COMPLETED' || file.status === 'PROCESSING') return;
    await this.prisma.cvFile.update({
      where: { id: fileId },
      data: { status: 'PROCESSING', error: null },
    });
    try {
      const buffer = await this.storage.download(file.storagePath);
      const text = await parseCvText(buffer, file.mimeType);
      if (!text.trim()) throw new Error('No readable text in the file');
      const extraction = await this.extract(file.userId, fileId, text);
      await this.prisma.cvFile.update({
        where: { id: fileId },
        data: {
          status: 'COMPLETED',
          rawText: null,
          extracted: extraction,
          error: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 300) : 'The CV could not be read';
      this.logger.warn(`cv extraction failed for ${fileId}: ${message}`);
      await this.prisma.cvFile.update({
        where: { id: fileId },
        data: { status: 'FAILED', error: message },
      });
    }
  }

  private async extract(userId: string, fileId: string, text: string): Promise<CvExtraction> {
    try {
      const { settings } = await this.aiUsage.assertAllowed(userId, AI_FEATURE.cv);
      const result = await this.gemini.generateJson({
        system: CV_SYSTEM,
        prompt: cvPrompt(text),
        temperature: settings.temperature,
        maxOutputTokens: 900,
        schema: {
          type: 'OBJECT',
          properties: {
            skills: { type: 'ARRAY', items: { type: 'STRING' } },
            technologies: { type: 'ARRAY', items: { type: 'STRING' } },
            experienceLevel: {
              type: 'STRING',
              enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
            },
            summary: { type: 'STRING' },
          },
          required: ['skills', 'technologies', 'experienceLevel', 'summary'],
        },
      });
      await this.aiUsage.record({
        userId,
        feature: AI_FEATURE.cv,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        requestId: fileId,
      });
      const parsed = CvExtractionSchema.omit({ source: true }).parse(parseJsonObject(result.text));
      return {
        skills: parsed.skills.map((skill) => this.guardrail.sanitizeField(skill)).slice(0, 30),
        technologies: parsed.technologies.map((tech) => this.guardrail.sanitizeField(tech)).slice(0, 30),
        experienceLevel: parsed.experienceLevel,
        summary: parsed.summary ? this.guardrail.sanitizeField(parsed.summary) : null,
        source: 'AI',
      };
    } catch (error) {
      if (isAiLimitError(error)) throw error;
      if (error instanceof AppError && error.code.startsWith('AI_')) {
        this.logger.warn(`CV AI unavailable, using rules: ${error.code}`);
      }
      return { ...rulesExtraction(text), source: 'RULES' };
    }
  }

  private toDto(file: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    status: string;
    extracted: unknown;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CvFile {
    const parsed = file.extracted ? CvExtractionSchema.safeParse(file.extracted) : null;
    return {
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status as CvFile['status'],
      extraction: parsed?.success ? parsed.data : null,
      error: file.error,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }
}

const RULE_SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'C++', 'PHP', 'Ruby',
  'React', 'Next.js', 'Node.js', 'NestJS', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker',
  'Kubernetes', 'AWS', 'Git', 'GraphQL', 'REST', 'Tailwind', 'Prisma', 'Supabase',
];

function rulesExtraction(text: string): Omit<CvExtraction, 'source'> {
  const found = RULE_SKILLS.filter((skill) => new RegExp(`\\b${escapeRegex(skill)}\\b`, 'i').test(text));
  const years = /(\d{1,2})\+?\s+years?/i.exec(text);
  const yearCount = years?.[1] ? Number(years[1]) : 0;
  const level = yearCount >= 5 ? 'ADVANCED' : yearCount >= 2 ? 'INTERMEDIATE' : 'BEGINNER';
  return {
    skills: [...new Set(found)].slice(0, 20),
    technologies: [...new Set(found)].slice(0, 20),
    experienceLevel: level,
    summary: 'Extracted with the local rules engine because the AI service was unavailable.',
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
