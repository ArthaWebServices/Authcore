import { render } from '@react-email/render';
import * as React from 'react';
import { VerificationEmail } from './templates/verification-email';
import { PasswordResetEmail } from './templates/password-reset';
import { WelcomeEmail } from './templates/welcome';

export const EmailTemplates = {
  verification: VerificationEmail,
  passwordReset: PasswordResetEmail,
  welcome: WelcomeEmail,
} as const;

export type EmailTemplateName = keyof typeof EmailTemplates;

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export async function renderEmail(
  template: EmailTemplateName,
  props: Record<string, unknown>,
): Promise<RenderedEmail> {
  const Component = EmailTemplates[template];
  const element = React.createElement(Component, props);

  const [html, text] = await Promise.all([render(element, { pretty: false }), render(element, { plainText: true })]);

  const subject = getSubject(template, props);

  return { html, text, subject };
}

function getSubject(template: EmailTemplateName, _props: Record<string, unknown>): string {
  switch (template) {
    case 'verification':
      return 'Verify your email address';
    case 'passwordReset':
      return 'Reset your password';
    case 'welcome':
      return 'Welcome aboard!';
    default:
      return 'AuthCore Notification';
  }
}
