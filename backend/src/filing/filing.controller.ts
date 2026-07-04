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
  Query,
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
import { FilingService } from './filing.service';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/filing')
export class FilingController {
  constructor(private readonly filing: FilingService) {}

  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.filing.list(businessId);
  }

  @Get('folders')
  folders(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.filing.folders(businessId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  upload(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folder') folder: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.filing.upload({
      businessId,
      folder,
      // Multer decodes the multipart filename as latin1; re-decode as UTF-8 so
      // Hebrew filenames are preserved instead of mojibake.
      filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      mimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      source: 'upload',
      createdByUserId: user.id,
    });
  }

  @Patch(':id')
  move(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('folder') folder: string | undefined,
  ) {
    if (!folder) throw new BadRequestException('folder is required');
    return this.filing.move(businessId, id, folder);
  }

  @Get(':id/download')
  async download(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { row, buffer } = await this.filing.download(businessId, id);
    res.set({
      'Content-Type': row.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        row.filename,
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
    await this.filing.remove(businessId, id);
    return { ok: true };
  }
}
