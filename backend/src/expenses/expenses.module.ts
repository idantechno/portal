import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { ContextFilesModule } from '../context-files/context-files.module';
import { Expense } from './expense.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpenseExtractorService } from './expense-extractor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense]),
    BusinessesModule,
    ContextFilesModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpenseExtractorService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
