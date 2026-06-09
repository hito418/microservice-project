import { Module } from '@nestjs/common';
import { ScoringModule } from './scoring/scoring.module';

@Module({
    imports: [ScoringModule],
})
export class AppModule {}
