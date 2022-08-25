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
