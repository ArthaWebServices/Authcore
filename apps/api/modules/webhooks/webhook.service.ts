import { createHmac, randomBytes } from 'crypto';
import { prisma } from '@shared/prisma';
import { logger } from '@shared/logger';
import { getConfig } from '@config';
import { NotFoundError, ValidationError } from '@shared/errors';

export type WebhookEvent =
  | 'user.registered'
  | 'user.login'
  | 'user.login.failed'
  | 'user.locked'
  | 'user.deleted'
  | 'user.password_reset'
  | 'user.mfa_enabled'
  | 'user.mfa_disabled'
  | 'session.created'
  | 'session.revoked'
  | 'organization.created'
  | 'organization.member_added'
  | 'admin.impersonation.start'
  | 'admin.impersonation.end'
  | 'webhook.test';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'user.registered',
  'user.login',
  'user.login.failed',
  'user.locked',
  'user.deleted',
  'user.password_reset',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'session.created',
  'session.revoked',
  'organization.created',
  'organization.member_added',
  'admin.impersonation.start',
  'admin.impersonation.end',
  'webhook.test',
];

export interface WebhookPublic {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface WebhookWithSecret extends WebhookPublic {
  secret: string;
}

export class WebhookService {
  /**
   * Create a new webhook subscription. Returns the secret ONCE.
   */
  async create(data: { name: string; url: string; events: string[]; organizationId?: string }): Promise<WebhookWithSecret> {
    if (data.events.length === 0) {
      throw new ValidationError('At least one event must be specified');
    }
    const invalid = data.events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalid.length > 0) {
      throw new ValidationError(`Unknown events: ${invalid.join(', ')}`);
    }

    const secret = `whsec_${randomBytes(32).toString('hex')}`;

    const webhook = await prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        secret,
        events: data.events,
        isActive: true,
      },
    });

    logger.info({ webhookId: webhook.id, url: data.url }, 'Webhook created');
    return this.toPublic(webhook) as WebhookWithSecret;
  }

  async list(organizationId?: string): Promise<WebhookPublic[]> {
    // Schema doesn't have organizationId on webhooks — list all
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map((w) => this.toPublic(w));
  }

  async getById(id: string): Promise<WebhookPublic> {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundError('Webhook');
    return this.toPublic(webhook);
  }

  async update(id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }): Promise<WebhookPublic> {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundError('Webhook');

    if (data.events) {
      const invalid = data.events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
      if (invalid.length > 0) {
        throw new ValidationError(`Unknown events: ${invalid.join(', ')}`);
      }
    }

    const updated = await prisma.webhook.update({ where: { id }, data });
    logger.info({ webhookId: id }, 'Webhook updated');
    return this.toPublic(updated);
  }

  async delete(id: string): Promise<void> {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundError('Webhook');
    await prisma.webhook.delete({ where: { id } });
    logger.info({ webhookId: id }, 'Webhook deleted');
  }

  /**
   * Dispatch an event to all subscribed webhooks. Uses HMAC SHA-256 signing.
   * Failed deliveries are stored with attempt count for retry.
   */
  async dispatch(event: WebhookEvent, payload: Record<string, unknown>): Promise<{ dispatched: number; failed: number }> {
    const webhooks = await prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });

    if (webhooks.length === 0) {
      return { dispatched: 0, failed: 0 };
    }

    let dispatched = 0;
    let failed = 0;

    for (const webhook of webhooks) {
      const success = await this.deliver(webhook.id, webhook.url, webhook.secret, event, payload);
      if (success) dispatched++;
      else failed++;
    }

    return { dispatched, failed };
  }

  private async deliver(
    webhookId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const config = getConfig();

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: { event, data: payload, timestamp: new Date().toISOString() } as any,
        status: 'pending',
        attempt: 1,
      },
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.WEBHOOK_TIMEOUT_MS);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AuthCore-Event': event,
          'X-AuthCore-Signature': `sha256=${signature}`,
          'X-AuthCore-Delivery': delivery.id,
          'User-Agent': 'AuthCore-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
            response: { status: res.status, statusText: res.statusText },
          },
        });
        return true;
      } else {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            error: `HTTP ${res.status}: ${res.statusText}`,
          },
        });
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', error: errorMessage },
      });
      logger.error({ webhookId, event, error: errorMessage }, 'Webhook delivery failed');
      return false;
    }
  }

  /**
   * Retry failed deliveries (used by cron job).
   */
  async retryFailed(): Promise<{ retried: number; succeeded: number }> {
    const config = getConfig();
    const failed = await prisma.webhookDelivery.findMany({
      where: { status: 'failed', attempt: { lt: config.WEBHOOK_RETRY_MAX } },
      include: { webhook: true },
      take: 50,
    });

    let succeeded = 0;
    for (const delivery of failed) {
      const body = JSON.stringify(delivery.payload);
      const signature = createHmac('sha256', delivery.webhook.secret).update(body).digest('hex');

      try {
        const res = await fetch(delivery.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AuthCore-Event': delivery.event,
            'X-AuthCore-Signature': `sha256=${signature}`,
            'X-AuthCore-Delivery': delivery.id,
            'User-Agent': 'AuthCore-Webhook/1.0',
          },
          body,
        });

        if (res.ok) {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: { status: 'delivered', deliveredAt: new Date(), attempt: { increment: 1 } },
          });
          succeeded++;
        } else {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: { error: `HTTP ${res.status}`, attempt: { increment: 1 } },
          });
        }
      } catch {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { attempt: { increment: 1 } },
        });
      }
    }

    return { retried: failed.length, succeeded };
  }

  /**
   * List recent deliveries for a webhook (for debugging).
   */
  async listDeliveries(webhookId: string, limit: number = 50): Promise<Array<{ id: string; event: string; status: string; attempt: number; error: string | null; createdAt: Date; deliveredAt: Date | null }>> {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return deliveries.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      attempt: d.attempt,
      error: d.error,
      createdAt: d.createdAt,
      deliveredAt: d.deliveredAt,
    }));
  }

  private toPublic(w: { id: string; name: string; url: string; events: string[]; isActive: boolean; createdAt: Date; secret?: string }): WebhookPublic | WebhookWithSecret {
    const base: WebhookPublic = {
      id: w.id,
      name: w.name,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      createdAt: w.createdAt,
    };
    return w.secret ? { ...base, secret: w.secret } : base;
  }
}
