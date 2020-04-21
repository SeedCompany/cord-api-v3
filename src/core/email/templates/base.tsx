import * as React from 'react';
import { FC, ReactElement } from 'react';
import {
  All,
  Attributes,
  Body,
  Button,
  Column,
  Divider,
  Font,
  Head,
  Image,
  Mjml,
  Raw,
  Section,
  Text,
  Title,
} from './mjml';
import { InText } from './text-rendering';

export const EmailTemplate: FC<{ title: string }> = ({ title, children }) => (
  <Mjml lang="en">
    <Head>
      <Title>{`${title} - CORD Field`}</Title>
      <Theme />
    </Head>
    <Body>
      <Branding />

      {children}
    </Body>
  </Mjml>
);

export const Theme = () => (
  <>
    <Font name="sofia-pro" href="https://use.typekit.net/qrd6jxb.css" />
    <Attributes>
      <All fontFamily="sofia-pro" fontSize={16} />
      <Body width={600} backgroundColor="#fafafa">
        {[]}
      </Body>
      <Section backgroundColor="#ffffff">{}</Section>
      <Text lineHeight="1.5">{}</Text>
      <Button color="#ffffff" backgroundColor="#64b145" padding="8px 22px">
        {[]}
      </Button>
      <Divider
        borderWidth={2}
        borderColor="#e6e6e6"
        paddingTop={15}
        paddingBottom={15}
      />
    </Attributes>
  </>
);

export const Branding = (): ReactElement => (
  <Section>
    <Column verticalAlign="middle" width="80px">
      <Image
        src="https://cordfield.com/assets/images/android-chrome-192x192.png"
        height={80}
        width={80}
        align="center"
        padding={0}
      />
    </Column>
    <Column verticalAlign="middle" width="220px">
      <Text fontSize={32} align="center">
        CORD Field
      </Text>
    </Column>
    <TextBreak />
  </Section>
);

export const Heading: FC = ({ children }) => (
  <Section>
    <Column>
      <Text align="center" fontSize={24}>
        {children}
      </Text>
      <TextBreak />
    </Column>
  </Section>
);

export const Link: FC<{ href: string }> = ({ href, children }) => (
  <Text>
    <a href={href} style={{ wordBreak: 'break-all' }}>
      {children || href}
    </a>
  </Text>
);

export const ReplyInfoFooter = () => (
  <Section>
    <Column>
      <Text fontWeight={300}>
        If you are having any issues with your account, please don't hesitate to
        contact us by replying to this email.
        <br />
        Thanks!
      </Text>
    </Column>
  </Section>
);

/**
 * Render a line break for text
 */
export const TextBreak = () => (
  <InText>
    <Raw>
      <br />
    </Raw>
  </InText>
);
