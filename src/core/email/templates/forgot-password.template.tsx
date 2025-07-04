import {
  Button,
  Column,
  HideInText,
  InText,
  Section,
  Text,
} from '@seedcompany/nestjs-email/templates';
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

      <Section>
        <Column>
          <Text align="center">If it was you, create a new password here</Text>
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
