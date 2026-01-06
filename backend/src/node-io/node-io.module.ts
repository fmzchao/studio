import { Module } from '@nestjs/common';
import { NodeIORepository } from './node-io.repository';
import { NodeIOService } from './node-io.service';
import { NodeIOIngestService } from './node-io-ingest.service';
import { DatabaseModule } from '../database/database.module';

const ingestServicesEnabled =
  (process.env.ENABLE_INGEST_SERVICES ?? 'true') === 'true' &&
  process.env.SKIP_INGEST_SERVICES !== 'true';

const ingestServices = ingestServicesEnabled ? [NodeIOIngestService] : [];

@Module({
  imports: [DatabaseModule],
  providers: [NodeIORepository, NodeIOService, ...ingestServices],
  exports: [NodeIOService, NodeIORepository],
})
export class NodeIOModule {}
