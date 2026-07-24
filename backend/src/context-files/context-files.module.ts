import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFile } from './context-file.entity';
import { ContextFilesService } from './context-files.service';
import { ContextFilesController } from './context-files.controller';
import { FilesystemService } from './filesystem.service';
import { BusinessContextService } from './business-context.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContextFile]), BusinessesModule],
  controllers: [ContextFilesController],
  providers: [ContextFilesService, FilesystemService, BusinessContextService],
  exports: [ContextFilesService, FilesystemService, BusinessContextService],
})
export class ContextFilesModule {}
