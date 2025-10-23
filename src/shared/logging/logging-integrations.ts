/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Reason: Integration code needs flexible typing for external libraries. Ticket: TICKET-REQUIRED */
// BullMQ integration: propagate traceId/correlationId in job metadata
import { Queue, Worker, Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { AppConfigUtil } from '../config/app-config.util';

// Producer example
export function addJobWithTrace(
  queue: Queue,
  cls: ClsService,
  data: any,
  domainId: string,
) {
  return queue.add(
    'send',
    {
      ...data,
      traceId: cls.get('traceId'),
      correlationId: cls.get('correlationId'),
    },
    {
      jobId: domainId,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}

// Worker example
export function setTraceContextOnJobStart(worker: Worker, cls: ClsService) {
  worker.on('active', (job: Job) => {
    const traceId = job.data?.traceId || job.id;
    const correlationId = job.data?.correlationId;

    cls.set('traceId', traceId);
    cls.set('correlationId', correlationId);

    // Log trace ID setting in BullMQ worker context
    console.log(
      JSON.stringify({
        '@timestamp': new Date().toISOString(),
        time: Date.now(),
        level: 30,
        level_label: 'info',
        service: { name: 'worker', namespace: 'bullmq' },
        component: 'BullMQWorker',
        method: 'setTraceContextOnJobStart',
        operation: 'trace_id_set',
        trace: { id: traceId },
        correlationId,
        jobId: job.id,
        source: job.data?.traceId ? 'job_data' : 'job_id_fallback',
        msg: 'Trace ID set in CLS context from BullMQ job',
      }),
    );
  });
}

// ESDB integration: append events with full metadata
export type AppendToStreamFn = (
  streamId: string,
  event: {
    type: string;
    data: unknown;
    metadata?: Record<string, unknown>;
  },
) => Promise<unknown> | void;

export function appendEventWithMetadata(
  appendToStream: AppendToStreamFn,
  cls: ClsService,
  streamId: string,
  eventType: string,
  data: unknown,
) {
  const metadata: Record<string, unknown> = {
    traceId: cls.get('traceId'),
    correlationId: cls.get('correlationId'),
    user: { id: cls.get('userId'), tenantId: cls.get('tenantId') },
    source: AppConfigUtil.getLoggingConfig().appName,
  };

  const result = appendToStream(streamId, {
    type: eventType,
    data,
    metadata,
  });

  return result;
}

// ESDB consumer: set CLS from event metadata
export function setClsFromEventMetadata(cls: ClsService, resolvedEvent: any) {
  const meta = resolvedEvent?.event?.metadata;
  cls.set('traceId', meta?.traceId);
  cls.set('correlationId', meta?.correlationId);
  cls.set('tenantId', meta?.user?.tenantId);
  cls.set('userId', meta?.user?.id);
}
