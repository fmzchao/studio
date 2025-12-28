import { Module } from '@nestjs/common';
import { HumanInputsController } from './human-inputs.controller';
import { HumanInputsService } from './human-inputs.service';
import { DatabaseModule } from '../database/database.module';

import { TemporalModule } from '../temporal/temporal.module';

@Module({
  imports: [DatabaseModule, TemporalModule],
  controllers: [HumanInputsController],
  providers: [HumanInputsService],
  exports: [HumanInputsService],
})
export class HumanInputsModule {}
