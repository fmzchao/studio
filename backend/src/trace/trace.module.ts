import { Global, Module } from '@nestjs/common';

import { TraceService } from './trace.service';
import { TraceRepository } from './trace.repository';
import { LogStreamRepository } from './log-stream.repository';
import { LogStreamService } from './log-stream.service';
import { DatabaseModule } from '../database/database.module';
import { LogIngestService } from '../logging/log-ingest.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [TraceRepository, TraceService, LogStreamRepository, LogStreamService, LogIngestService],
  exports: [TraceService, TraceRepository, LogStreamRepository, LogStreamService],
})
export class TraceModule {}
