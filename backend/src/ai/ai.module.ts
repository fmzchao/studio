import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { forwardRef } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [forwardRef(() => ApiKeysModule)],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
