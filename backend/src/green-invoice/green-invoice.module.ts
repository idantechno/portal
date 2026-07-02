import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { GreenInvoiceConnection } from './green-invoice-connection.entity';
import { GreenInvoiceService } from './green-invoice.service';
import { GreenInvoiceController } from './green-invoice.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GreenInvoiceConnection]),
    BusinessesModule,
  ],
  controllers: [GreenInvoiceController],
  providers: [GreenInvoiceService],
  exports: [GreenInvoiceService],
})
export class GreenInvoiceModule {}
