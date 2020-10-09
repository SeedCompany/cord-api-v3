import * as React from 'react';
import { EmailTemplate, Heading, Link, ReplyInfoFooter } from './base';
import { Button, Column, Section, Text } from './mjml';
import { HideInText, InText } from './text-rendering';

export interface ForgotPasswordProps {
  url: string;
}

export function ForgotPassword({ url }: ForgotPasswordProps) {
  return (
    <EmailTemplate title="Forgot Password">
      <Heading>You have submitted a password change request!</Heading>

      <Section>
        <Column>
          <Text>
            If it was you, confirm the password change{' '}
            <InText>by clicking this link</InText>
          </Text>
          <HideInText>
            <Button href={url}>CONFIRM</Button>
          </HideInText>
          <InText>
            <Link href={url} />
          </InText>
        </Column>
      </Section>

      <ReplyInfoFooter />
    </EmailTemplate>
  );
}
