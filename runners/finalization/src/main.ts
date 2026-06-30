import { QUEUE_NAMES } from '@repo/queue';
import { runWorker } from '@repo/runner';
import { AppModule } from './app.module';

void runWorker(AppModule, QUEUE_NAMES.FINALIZATION);
