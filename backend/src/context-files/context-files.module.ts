import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFile } from './context-file.entity';
import { ContextFilesService } from './context-files.service';
import { ContextFilesController } from './context-files.controller';
import { FilesystemService } from './filesystem.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContextFile]), BusinessesModule],
  controllers: [ContextFilesController],
  providers: [ContextFilesService, FilesystemService],
  exports: [ContextFilesService, FilesystemService],
})
export class ContextFilesModule {}
