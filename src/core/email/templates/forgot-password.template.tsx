import { InHtml, InText } from '@seedcompany/nestjs-email/templates';
import * as Mjml from '@seedcompany/nestjs-email/templates/mjml';
import { EmailTemplate, Heading, Link, ReplyInfoFooter } from './base';
import { useFrontendUrl } from './frontend-url';

export interface ForgotPasswordProps {
  token: string;
}

export function ForgotPassword({ token }: ForgotPasswordProps) {
  const url = useFrontendUrl(`/reset-password/${token}`);
  return (
    <EmailTemplate title="Reset Password" preview={null}>
      <Heading>We received your password reset request</Heading>

      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text align="center">
            If it was you, create a new password here
          </Mjml.Text>
          <InHtml>
            <Mjml.Button href={url}>CONFIRM</Mjml.Button>
          </InHtml>
          <InText>
            <Link href={url} />
          </InText>
        </Mjml.Column>
      </Mjml.Section>

      <ReplyInfoFooter />
    </EmailTemplate>
  );
}
