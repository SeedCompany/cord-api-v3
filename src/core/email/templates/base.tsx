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
  InText,
  Mjml,
  Preview,
  Raw,
  Section,
  Style,
  Text,
  Title,
  Wrapper,
} from '@seedcompany/nestjs-email/templates';
import {
  type ComponentProps,
  Fragment,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useFrontendUrl } from './frontend-url';

export const EmailTemplate = ({
  title,
  preview,
  children,
}: {
  title: string;
  preview?: ReactNode;
  children: ReactNode;
}) => (
  <Mjml lang="en">
    <Head>
      <Title>{`${title} - CORD Field`}</Title>
      {preview != null && (
        <Preview>
          {preview}
          {/* Fill the remaining space with nothing-ness so the email context is avoided */}
          {[...Array(140).keys()].map((i) => (
            <Fragment key={i}>&#847;&zwnj;&nbsp;</Fragment>
          ))}
        </Preview>
      )}
      <Theme />
      <Style
        inline
        children={`
.card-shadow {
  -webkit-box-shadow: 0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12);
  -moz-box-shadow: 0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12);
  box-shadow: 0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12);
}
.button-shadow td {
  -webkit-box-shadow: 0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12);
  -moz-box-shadow: 0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12);
  box-shadow: 0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12);
}
        `}
      />
    </Head>
    <Body>
      <Branding />

      <Wrapper
        cssClass="card-shadow"
        borderRadius={6}
        backgroundColor="#ffffff"
      >
        {children}
      </Wrapper>
    </Body>
  </Mjml>
);

export const Theme = () => (
  <>
    <Font name="sofia-pro" href="https://use.typekit.net/qrd6jxb.css" />
    <Attributes>
      <All fontFamily="sofia-pro, sans-serif" fontSize="16px" />
      <Body width={600} backgroundColor="#fafafa">
        {[]}
      </Body>
      <Section backgroundColor="#ffffff">{}</Section>
      <Text lineHeight="1.5">{}</Text>
      <Button
        color="#ffffff"
        backgroundColor="#1ea973"
        padding="8px 22px"
        cssClass="button-shadow"
      >
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

export const Branding = (): ReactElement => {
  const iconUrl = useFrontendUrl('/images/cord-icon.png');
  return (
    <Section backgroundColor="#fafafa">
      <Column verticalAlign="middle" width="80px">
        <Image
          src={iconUrl}
          height={80}
          width={80}
          align="center"
          padding={0}
        />
      </Column>
      <Column verticalAlign="middle" width="220px">
        <Text fontSize={32} align="center">
          <span style={{ whiteSpace: 'nowrap !important' }}>CORD Field</span>
        </Text>
      </Column>
      <TextBreak />
      <TextBreak />
    </Section>
  );
};

export const Heading = (props: ComponentProps<typeof Text>) => (
  <Section>
    <Column padding={0}>
      <Text fontSize={24} paddingTop={0} paddingBottom={0} {...props}>
        {props.children}
      </Text>
      <TextBreak />
      <TextBreak />
    </Column>
  </Section>
);

export const Link = ({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) => (
  <Text>
    <a href={href} style={{ wordBreak: 'break-all' }}>
      {children || href}
    </a>
  </Text>
);

export const ReplyInfoFooter = () => (
  <Section>
    <Column>
      <Divider borderWidth={1} />
      <Text fontWeight="300">
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
