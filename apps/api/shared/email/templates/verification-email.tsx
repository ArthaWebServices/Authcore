import * as React from 'react';
import { Button, Heading, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface VerificationEmailProps {
  name?: string;
  verificationUrl: string;
  expiresInHours?: number;
  appName?: string;
}

export const VerificationEmail: React.FC<VerificationEmailProps> = ({
  name,
  verificationUrl,
  expiresInHours = 24,
  appName = 'AuthCore',
}) => {
  return (
    <BaseLayout preview={`Verify your email to complete your ${appName} registration`}>
      <Heading style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>
        Welcome{name ? `, ${name}` : ''}!
      </Heading>
      <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#4a4a4a' }}>
        Thanks for signing up for {appName}. Please verify your email address by clicking the button below.
      </Text>
      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button
          href={verificationUrl}
          style={{
            backgroundColor: '#007bff',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Verify Email Address
        </Button>
      </Section>
      <Text style={{ fontSize: '14px', lineHeight: '20px', color: '#6a6a6a' }}>
        Or copy and paste this URL into your browser:
      </Text>
      <Text style={{ fontSize: '12px', lineHeight: '16px', color: '#007bff', wordBreak: 'break-all' }}>
        {verificationUrl}
      </Text>
      <Text style={{ fontSize: '14px', lineHeight: '20px', color: '#6a6a6a', marginTop: '24px' }}>
        This verification link will expire in {expiresInHours} hours. If you didn't create an account, no
        action is required.
      </Text>
    </BaseLayout>
  );
};
