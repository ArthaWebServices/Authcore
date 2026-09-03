import * as React from 'react';
import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface PasswordResetEmailProps {
  name?: string;
  resetUrl: string;
  expiresInHours?: number;
  ipAddress?: string;
  appName?: string;
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  name,
  resetUrl,
  expiresInHours = 1,
  ipAddress,
  appName = 'AuthCore',
}) => {
  return (
    <BaseLayout preview={`Reset your ${appName} password`}>
      <Heading style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>
        Password Reset Request
      </Heading>
      <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#4a4a4a' }}>
        Hi{name ? ` ${name}` : ''}, we received a request to reset your password.
      </Text>
      <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#4a4a4a' }}>
        Click the button below to choose a new password:
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button
          href={resetUrl}
          style={{
            backgroundColor: '#dc3545',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Reset Password
        </Button>
      </Section>
      <Text style={{ fontSize: '14px', lineHeight: '20px', color: '#6a6a6a' }}>
        Or copy and paste this URL into your browser:
      </Text>
      <Text style={{ fontSize: '12px', lineHeight: '16px', color: '#dc3545', wordBreak: 'break-all' }}>
        {resetUrl}
      </Text>
      <Text style={{ fontSize: '14px', lineHeight: '20px', color: '#6a6a6a', marginTop: '24px' }}>
        This link will expire in {expiresInHours} hour{expiresInHours > 1 ? 's' : ''}. If you didn't request
        a password reset, you can safely ignore this email.
      </Text>
      {ipAddress && (
        <Text style={{ fontSize: '12px', lineHeight: '16px', color: '#8898aa', marginTop: '16px' }}>
          Request initiated from: {ipAddress}
        </Text>
      )}
    </BaseLayout>
  );
};
