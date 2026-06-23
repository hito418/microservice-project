import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { DebateController } from './debate.controller';
import { DebateService } from './debate.service';
import { RoomRepository } from './room.repository';

@Module({
    imports: [DatabaseModule],
    controllers: [DebateController],
    providers: [DebateService, RoomRepository],
})
export class DebateModule {}
