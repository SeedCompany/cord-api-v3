import { Processor, WorkerHost } from '~/core/queue';
import { type JobOf } from '~/core/queue';
import { WebhookDeliveryQueue } from './webhook-delivery.queue';
import { WebhookSender } from './webhook.sender';

type Job = JobOf<WebhookDeliveryQueue>;

@Processor(WebhookDeliveryQueue.NAME, {
  // This queue is just delivering the payload to the webhook URL,
  // so just a lot of network waiting and not much CPU work.
  // Choosing a higher concurrency for that reason.
  concurrency: 10,
  settings: {
    backoffStrategy: WebhookDeliveryQueue.retryStrategy,
  },
})
export class WebhookDeliveryWorker extends WorkerHost {
  constructor(private readonly sender: WebhookSender) {
    super();
  }

  async process(job: Job) {
    const success = await this.sender.send(job.data, {
      attempt: job.attemptsMade + 1,
      requestId: job.id!,
    });
    if (!success) {
      throw new Error();
    }
  }
}
