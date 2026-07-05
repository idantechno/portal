import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Express } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { ExpensesService } from './expenses.service';
import { ExpenseKind } from './expense.entity';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

function parseKind(v: unknown): ExpenseKind | undefined {
  return v === 'fixed' || v === 'occasional' ? v : undefined;
}
function parseCents(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v !== '') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.expenses.list(businessId);
  }

  @Get('summary')
  summary(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.expenses.summary(businessId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      kind?: string;
      title?: string;
      amountCents?: string;
      expenseDate?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenses.create({
      businessId,
      kind: parseKind(body.kind),
      title: body.title,
      amountCents: parseCents(body.amountCents),
      expenseDate: body.expenseDate || null,
      createdByUserId: user.id,
      file: file
        ? {
            buffer: file.buffer,
            mimeType: file.mimetype,
            // Multer decodes multipart filenames as latin1 — re-decode as UTF-8
            // so Hebrew names survive.
            fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
            size: file.size,
          }
        : undefined,
    });
  }

  @Patch(':id')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      title?: string;
      kind?: string;
      amountCents?: number | null;
      expenseDate?: string | null;
      note?: string | null;
    },
  ) {
    const kind = body.kind === undefined ? undefined : parseKind(body.kind);
    if (body.kind !== undefined && kind === undefined) {
      throw new BadRequestException('Invalid kind');
    }
    return this.expenses.update(businessId, id, {
      title: body.title,
      kind,
      amountCents: body.amountCents,
      expenseDate: body.expenseDate,
      note: body.note,
    });
  }

  @Get(':id/file')
  async file(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { row, buffer } = await this.expenses.download(businessId, id);
    res.set({
      'Content-Type': row.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        row.fileName ?? 'expense',
      )}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Delete(':id')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.expenses.remove(businessId, id);
    return { ok: true };
  }
}
