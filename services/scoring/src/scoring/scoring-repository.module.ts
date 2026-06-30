import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { ScoringRepository } from './scoring.repository';

@Module({
    imports: [DatabaseModule],
    providers: [ScoringRepository],
    exports: [ScoringRepository],
})
export class ScoringRepositoryModule {}
