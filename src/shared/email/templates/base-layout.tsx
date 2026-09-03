import * as React from 'react';
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text, Tailwind } from '@react-email/components';

const baseStyles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    marginBottom: '64px',
  },
  logo: {
    margin: '0 auto',
  },
  hr: {
    borderColor: '#e6ebf1',
    margin: '20px 0',
  },
  footer: {
    color: '#8898aa',
    fontSize: '12px',
    lineHeight: '16px',
    textAlign: 'center' as const,
  },
  link: {
    color: '#556cd6',
    textDecoration: 'underline',
  },
};

export interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  showFooter?: boolean;
}

export const BaseLayout: React.FC<BaseLayoutProps> = ({ preview, children, showFooter = true }) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body style={baseStyles.body}>
          <Container style={baseStyles.container}>
            <Section style={{ padding: '0 48px' }}>
              <Img
                src={`${process.env.APP_URL || 'http://localhost:3000'}/logo.png`}
                width="120"
                height="36"
                alt="AuthCore"
                style={baseStyles.logo}
              />
              <Hr style={baseStyles.hr} />
              {children}
            </Section>
            {showFooter && (
              <>
                <Hr style={baseStyles.hr} />
                <Section style={{ padding: '0 48px' }}>
                  <Text style={baseStyles.footer}>
                    © {new Date().getFullYear()} AuthCore. All rights reserved.
                    <br />
                    <Link href={`${process.env.APP_URL || 'http://localhost:3000'}/unsubscribe`} style={baseStyles.link}>
                      Unsubscribe
                    </Link>
                    {' · '}
                    <Link href={`${process.env.APP_URL || 'http://localhost:3000'}/privacy`} style={baseStyles.link}>
                      Privacy Policy
                    </Link>
                  </Text>
                </Section>
              </>
            )}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
