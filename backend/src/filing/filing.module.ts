import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { FiledDocument } from './filed-document.entity';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FiledDocument]),
    BusinessesModule,
    ContextFilesModule,
  ],
  controllers: [FilingController],
  providers: [FilingService],
  exports: [FilingService],
})
export class FilingModule {}
