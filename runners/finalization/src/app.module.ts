import { Module } from '@nestjs/common';
import { JOB_PROCESSOR } from '@repo/runner';
import { FinalizationProcessor } from './finalization.processor';
import { ScoringClientModule } from './scoring-client.module';

@Module({
    imports: [ScoringClientModule],
    providers: [{ provide: JOB_PROCESSOR, useClass: FinalizationProcessor }],
})
export class AppModule {}
