import { addEmailJob } from '../queue/email.queue';
import { getConfig } from '../../config';
import { logger } from '../logger';
import { createTransport } from 'nodemailer';
import { Resend } from 'resend';

export class EmailService {
  private readonly resend: Resend;
  private readonly transport?: ReturnType<typeof createTransport>;

  constructor() {
    const config = getConfig();
    this.resend = new Resend(config.RESEND_API_KEY);

    // Optional: Use nodemailer as fallback
    if (config.RESEND_API_KEY) {
      this.resend = new Resend(config.RESEND_API_KEY);
    } else {
      // Fallback to nodemailer (would need SMTP config)
      this.transport = createTransport({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'example@example.com',
          pass: 'example',
        },
      });
    }
  }

  async sendVerificationEmail(userEmail: string, token: string): Promise<void> {
    const verificationUrl = `${getConfig().APP_URL}/auth/verify-email?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a;">Welcome to AuthCore</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
          Verify Email
        </a>
        <p style="margin-top: 20px; color: #666;">This link expires in 24 hours.</p>
        <p style="margin-top: 30px;">Best regards,<br>AuthCore Team</p>
      </div>
    `;

    try {
      await this.resend.emails.send({
        from: getConfig().EMAIL_FROM,
        to: userEmail,
        subject: 'Verify your email address',
        html,
      });
      logger.info({ user: userEmail }, 'Verification email sent');
    } catch (error) {
      logger.error({ error, email: userEmail }, 'Failed to send verification email');
      throw error;
    }
  }

  async sendPasswordResetEmail(userEmail: string, token: string): Promise<void> {
    const resetUrl = `${getConfig().APP_URL}/auth/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a;">Password Reset Request</h1>
        <p>You requested a password reset for your AuthCore account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
        <p style="margin-top: 20px; color: #666;">This link expires in 1 hour.</p>
        <p style="margin-top: 30px;">Best regards,<br>AuthCore Team</p>
      </div>
    `;

    try {
      await this.resend.emails.send({
        from: getConfig().EMAIL_FROM,
        to: userEmail,
        subject: 'Password Reset',
        html,
      });
      logger.info({ user: userEmail }, 'Password reset email sent');
    } catch (error) {
      logger.error({ error, email: userEmail }, 'Failed to send password reset email');
      throw error;
    }
  }
}