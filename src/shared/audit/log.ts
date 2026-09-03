// Shared audit/logging utilities
import { logger } from '../logger';

export interface AuditEvent {
  eventType: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  riskScore?: number;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    logger.info(
      {
        eventType: event.eventType,
        userId: event.userId,
        sessionId: event.sessionId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
        riskScore: event.riskScore,
      },
      `Audit event: ${event.eventType}`,
    );
  } catch (error) {
    logger.error({ error, event }, 'Failed to log audit event');
  }
}
