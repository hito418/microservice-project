import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from '../db/database.module';
import type { Database, RoomRow, RoomTransitionRow } from '../db/database.types';

@Injectable()
export class RoomRepository {
    constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

    findById(roomId: string): Promise<RoomRow | undefined> {
        return this.db
            .selectFrom('rooms')
            .selectAll()
            .where('id', '=', roomId)
            .executeTakeFirst();
    }

    async create(debateId: string): Promise<RoomRow> {
        return this.db
            .insertInto('rooms')
            .values({ debate_id: debateId })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async transitionState(roomId: string, fromState: string, toState: string): Promise<RoomRow> {
        return this.db.transaction().execute(async (trx) => {
            await trx
                .insertInto('room_transitions')
                .values({ room_id: roomId, from_state: fromState, to_state: toState })
                .execute();
            return trx
                .updateTable('rooms')
                .set({ state: toState, updated_at: sql`now()` })
                .where('id', '=', roomId)
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }

    getTransitions(roomId: string): Promise<RoomTransitionRow[]> {
        return this.db
            .selectFrom('room_transitions')
            .selectAll()
            .where('room_id', '=', roomId)
            .orderBy('transitioned_at', 'asc')
            .execute();
    }
}
