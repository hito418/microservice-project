import { Injectable, type LogLevel } from '@nestjs/common';
import { parsePort, resolveLogLevels } from '@repo/common';

@Injectable()
export class ConfigService {
    get serverHost(): string {
        return process.env.SCORING_HOST ?? '127.0.0.1';
    }
    get serverPort(): number {
        return parsePort('SCORING_PORT', 4002);
    }

    get logLevels(): LogLevel[] {
        return resolveLogLevels();
    }
}
