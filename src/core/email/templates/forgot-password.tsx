import * as React from 'react';
import { Body, Button, Column, Head, Mjml, Section, Text, Title } from './mjml';

export interface ForgotPasswordProps {
  url: string;
}

export function ForgotPassword({ url }: ForgotPasswordProps) {
  return (
    <Mjml lang="en">
      <Head>
        <Title>Forgot Password - CORD Field</Title>
      </Head>
      <Body>
        <Section>
          <Column>
            <Text>This is your secret login code:</Text>
            <Button href={url}>Go to Login</Button>
          </Column>
        </Section>
      </Body>
    </Mjml>
  );
}
