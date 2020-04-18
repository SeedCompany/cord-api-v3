import * as React from 'react';
import { EmailTemplate, Heading, Link, ReplyInfoFooter } from './base';
import { Button, Column, Divider, Section, Text } from './mjml';
import { HideInText } from './text-rendering';

export interface ForgotPasswordProps {
  url: string;
}

export function ForgotPassword({ url }: ForgotPasswordProps) {
  return (
    <EmailTemplate title="Forgot Password">
      <Heading>You have submitted a password change request!</Heading>

      <Section>
        <Column>
          <Text>If it was you, confirm the password change</Text>
          <Link href={url} />
          <Divider borderWidth={1} />
          <HideInText>
            <Button href={url}>CONFIRM</Button>
          </HideInText>
        </Column>
      </Section>

      <ReplyInfoFooter />
    </EmailTemplate>
  );
}
