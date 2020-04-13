import * as React from 'react';
import { Branding, Heading, Link, ReplyInfoFooter, Theme } from './base';
import {
  Body,
  Button,
  Column,
  Divider,
  Head,
  Mjml,
  Section,
  Text,
  Title,
} from './mjml';
import { HideInText } from './text-rendering';

export interface ForgotPasswordProps {
  url: string;
}

export function ForgotPassword({ url }: ForgotPasswordProps) {
  return (
    <Mjml lang="en">
      <Head>
        <Title>Forgot Password - CORD Field</Title>
        <Theme />
      </Head>
      <Body>
        <Branding />

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
      </Body>
    </Mjml>
  );
}
