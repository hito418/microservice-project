import { Logger, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolveLogLevels } from '@repo/common';
import { type QueueName, redisConnectionFromEnv } from '@repo/queue';
import { Worker } from 'bullmq';
import { JOB_PROCESSOR, type JobProcessor } from './job-processor';

const DEFAULT_CONCURRENCY = 1;

function resolveConcurrency(): number {
    const raw = process.env.WORKER_CONCURRENCY;
    if (raw === undefined || raw === '') return DEFAULT_CONCURRENCY;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('WORKER_CONCURRENCY must be a positive integer');
    }
    return parsed;
}

/**
 * Boots a runner: a Nest application context (DI/config/logging, no HTTP/gRPC
 * server) wrapping a single BullMQ Worker. The processor is resolved from the
 * context via JOB_PROCESSOR. Closes the worker and context cleanly on SIGTERM/
 * SIGINT so in-flight jobs drain before exit.
 */
export async function runWorker(
    module: Type<unknown>,
    queueName: QueueName,
): Promise<void> {
    const logger = new Logger('Worker');
    const app = await NestFactory.createApplicationContext(module, {
        logger: resolveLogLevels(),
    });
    app.enableShutdownHooks();

    const processor = app.get<JobProcessor<unknown>>(JOB_PROCESSOR);
    const concurrency = resolveConcurrency();

    const worker = new Worker(queueName, (job) => processor.process(job), {
        connection: redisConnectionFromEnv(),
        concurrency,
    });

    worker.on('failed', (job, err) => {
        logger.error(
            `Job ${job?.id ?? '<unknown>'} on "${queueName}" failed: ${err.message}`,
        );
    });
    worker.on('error', (err) => {
        logger.error(`Worker error on "${queueName}": ${err.message}`);
    });

    logger.log(
        `Worker listening on queue "${queueName}" (concurrency ${concurrency})`,
    );

    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.log(`Received ${signal}, draining worker...`);
        try {
            await worker.close();
            await app.close();
        } catch (err) {
            logger.error(
                `Error during shutdown: ${err instanceof Error ? err.message : String(err)}`,
            );
            process.exitCode = 1;
        }
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}
