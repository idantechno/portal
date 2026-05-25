import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { UserRole } from '../common/enums/user-role.enum';
import { BusinessScopeGuard } from '../businesses/guards/business-scope.guard';
import { ContextFilesService } from './context-files.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_BYTES = 1024 * 1024; // 1MB for inline-edited text

@UseGuards(BusinessScopeGuard)
@Controller('businesses/:businessId/files')
export class ContextFilesController {
  constructor(private readonly files: ContextFilesService) {}

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const includeHidden = user.role === UserRole.GlobalAdmin;
    return this.files.list(businessId, includeHidden);
  }

  @Get('tree')
  tree(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const includeHidden = user.role === UserRole.GlobalAdmin;
    return this.files.tree(businessId, includeHidden);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('hidden') hidden: string | undefined,
    @Query('folder') folder: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const wantsHidden = hidden === 'true' || hidden === '1';
    if (wantsHidden && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException(
        'Only global admins can upload hidden files',
      );
    }
    return this.files.upload({
      businessId,
      uploadedByUserId: user.id,
      originalName: file.originalname,
      folder,
      buffer: file.buffer,
      mimeType: file.mimetype,
      hidden: wantsHidden,
    });
  }

  @Post('folders')
  async createFolder(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { path?: string; hidden?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body?.path) throw new BadRequestException('path is required');
    const wantsHidden = body.hidden === true;
    if (wantsHidden && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException(
        'Only global admins can create hidden folders',
      );
    }
    return this.files.createFolder(businessId, body.path, wantsHidden);
  }

  @Post('create')
  async createTextFile(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body()
    body: {
      path?: string;
      content?: string;
      hidden?: boolean;
      mimeType?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body?.path) throw new BadRequestException('path is required');
    const content = body.content ?? '';
    if (Buffer.byteLength(content, 'utf-8') > MAX_TEXT_BYTES) {
      throw new BadRequestException('Content too large');
    }
    const wantsHidden = body.hidden === true;
    if (wantsHidden && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException(
        'Only global admins can create hidden files',
      );
    }
    return this.files.createTextFile({
      businessId,
      uploadedByUserId: user.id,
      path: body.path,
      content,
      hidden: wantsHidden,
      mimeType: body.mimeType,
    });
  }

  @Get(':fileId/content')
  async getContent(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { file, content } = await this.files.getContent(businessId, fileId);
    if (file.hiddenForBusiness && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException('Hidden file');
    }
    return { file, content };
  }

  @Put(':fileId/content')
  async updateContent(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() body: { content?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await this.files.getById(businessId, fileId);
    if (file.hiddenForBusiness && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException('Hidden file');
    }
    const content = body?.content ?? '';
    if (Buffer.byteLength(content, 'utf-8') > MAX_TEXT_BYTES) {
      throw new BadRequestException('Content too large');
    }
    return this.files.updateContent(businessId, fileId, content);
  }

  @Patch(':fileId/path')
  async move(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() body: { newPath?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body?.newPath) throw new BadRequestException('newPath is required');
    const isGlobalAdmin = user.role === UserRole.GlobalAdmin;
    return this.files.move(businessId, fileId, body.newPath, isGlobalAdmin);
  }

  @Get(':fileId')
  async download(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { file, buffer } = await this.files.download(businessId, fileId);
    if (file.hiddenForBusiness && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException('Hidden file');
    }
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        file.relativePath.split('/').pop() ?? 'file',
      )}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Delete(':fileId')
  async remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await this.files.getById(businessId, fileId);
    if (file.hiddenForBusiness && user.role !== UserRole.GlobalAdmin) {
      throw new ForbiddenException('Hidden file');
    }
    await this.files.remove(businessId, fileId);
    return { ok: true };
  }
}
