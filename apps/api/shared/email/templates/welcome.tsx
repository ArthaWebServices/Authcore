import * as React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface WelcomeEmailProps {
  name?: string;
  dashboardUrl: string;
  appName?: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({
  name,
  dashboardUrl,
  appName = 'AuthCore',
}) => {
  return (
    <BaseLayout preview={`Welcome to ${appName}!`}>
      <Heading style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a1a' }}>
        You're all set{name ? `, ${name}` : ''}! 🎉
      </Heading>
      <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#4a4a4a' }}>
        Your email is verified and your account is fully activated. Welcome aboard!
      </Text>
      <Text style={{ fontSize: '16px', lineHeight: '24px', color: '#4a4a4a' }}>
        To get started, head over to your dashboard:
      </Text>
      <Button
        href={dashboardUrl}
        style={{
          backgroundColor: '#28a745',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '12px 24px',
          borderRadius: '4px',
          textDecoration: 'none',
          display: 'inline-block',
          margin: '16px 0',
        }}
      >
        Go to Dashboard
      </Button>
      <Text style={{ fontSize: '14px', lineHeight: '20px', color: '#6a6a6a', marginTop: '24px' }}>
        Need help? Reply to this email and we'll be happy to assist.
      </Text>
    </BaseLayout>
  );
};
