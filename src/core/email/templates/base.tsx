import * as Meta from '@seedcompany/nestjs-email/templates';
import * as Mjml from '@seedcompany/nestjs-email/templates/mjml';
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
  <Mjml.Doc lang="en">
    <Mjml.Head>
      <Meta.Headers subject={title} />
      <Mjml.Title>{title}</Mjml.Title>
      {preview != null && (
        <Meta.InHtml>
          <Mjml.Preview>
            {preview}
            {/* Fill the remaining space with nothing-ness so the email context is avoided */}
            {[...Array(140).keys()].map((i) => (
              <Fragment key={i}>&#847;&zwnj;&nbsp;</Fragment>
            ))}
          </Mjml.Preview>
        </Meta.InHtml>
      )}
      <Theme />
      <Mjml.Style
        inline
        children={`
.body {
  /* prevents card shadow being cut off */
  padding: 8px;
  /* add more just to look more symmetrical with branding header */
  padding-bottom: 48px;
}
.card-shadow {
  -webkit-box-shadow: rgba(0, 0, 0, 0.2) 0px 3px 1px -2px, rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px;
  -moz-box-shadow: rgba(0, 0, 0, 0.2) 0px 3px 1px -2px, rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 3px 1px -2px, rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px;
}
.button-shadow td {
  -webkit-box-shadow: 0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12);
  -moz-box-shadow: 0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12);
  box-shadow: 0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12);
}
        `}
      />
    </Mjml.Head>
    <Mjml.Body>
      <Meta.InHtml>
        <Branding />
      </Meta.InHtml>

      <Mjml.Wrapper
        cssClass="card-shadow"
        borderRadius={6}
        backgroundColor="#ffffff"
      >
        {children}
      </Mjml.Wrapper>
    </Mjml.Body>
  </Mjml.Doc>
);

const Theme = () => (
  <>
    <Mjml.Font name="sofia-pro" href="https://use.typekit.net/qrd6jxb.css" />
    <Mjml.Attributes>
      <Mjml.All fontFamily="sofia-pro, sans-serif" fontSize="16px" />
      <Mjml.Body width={600} backgroundColor="#fafafa" cssClass="body">
        {[]}
      </Mjml.Body>
      <Mjml.Section backgroundColor="#ffffff">{}</Mjml.Section>
      <Mjml.Text lineHeight="1.5">{}</Mjml.Text>
      <Mjml.Button
        color="#ffffff"
        backgroundColor="#1ea973"
        padding="8px 22px"
        cssClass="button-shadow"
      >
        {[]}
      </Mjml.Button>
      <Mjml.Divider
        borderWidth={2}
        borderColor="#e6e6e6"
        paddingTop={15}
        paddingBottom={15}
      />
    </Mjml.Attributes>
  </>
);

const Branding = (): ReactElement => {
  const iconUrl = useFrontendUrl('/images/cord-icon.png');
  return (
    <Mjml.Section backgroundColor="#fafafa">
      <Mjml.Column verticalAlign="middle" width="80px">
        <Mjml.Image
          src={iconUrl}
          height={80}
          width={80}
          align="center"
          padding={0}
        />
      </Mjml.Column>
      <Mjml.Column verticalAlign="middle" width="220px">
        <Mjml.Text fontSize={32} align="center">
          <span style={{ whiteSpace: 'nowrap !important' }}>CORD Field</span>
        </Mjml.Text>
      </Mjml.Column>
      <TextBreak />
      <TextBreak />
    </Mjml.Section>
  );
};

export const Heading = (props: ComponentProps<typeof Mjml.Text>) => (
  <Mjml.Section>
    <Mjml.Column padding={0}>
      <Mjml.Text fontSize={24} paddingTop={0} paddingBottom={0} {...props}>
        {props.children}
      </Mjml.Text>
      <TextBreak />
      <TextBreak />
    </Mjml.Column>
  </Mjml.Section>
);

export const Link = ({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) => (
  <Mjml.Text>
    <a href={href} style={{ wordBreak: 'break-all' }}>
      {children || href}
    </a>
  </Mjml.Text>
);

export const ReplyInfoFooter = () => (
  <Mjml.Section>
    <Mjml.Column>
      <Mjml.Divider borderWidth={1} />
      <Mjml.Text fontWeight="300">
        If you are having any issues with your account, please don't hesitate to
        contact us by replying to this email.
        <br />
        Thanks!
      </Mjml.Text>
    </Mjml.Column>
  </Mjml.Section>
);

/**
 * Render a line break for text
 */
export const TextBreak = () => (
  <Meta.InText>
    <Mjml.Raw>
      <br />
    </Mjml.Raw>
  </Meta.InText>
);
