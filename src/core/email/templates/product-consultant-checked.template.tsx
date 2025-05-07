import { Head, Section, Text } from '@seedcompany/nestjs-email/templates';
import { type Engagement } from '../../../components/engagement/dto';
import { type Language } from '../../../components/language/dto';
import { type User } from '../../../components/user/dto';
import { EmailTemplate } from './base';
import { useFrontendUrl } from './frontend-url';

export interface GoalCompletedProps {
  recipient: Pick<
    User,
    'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  engagement: Pick<Engagement, 'id'>;
  language: Pick<Language, 'id' | 'name' | 'ethnologue'>;
  products: Array<{
    id: string;
    name: string;
  }>;
}

export function GoalCompleted({
  recipient,
  language,
  products,
  engagement,
}: GoalCompletedProps) {
  const engagementUrl = useFrontendUrl(`/engagements/${engagement.id}`);
  const languageName = language.name.value;
  const title = `Next Steps for Uploading ${languageName || 'Language'}`;

  return (
    <EmailTemplate title={title}>
      Dear {recipient.displayFirstName.value},
      <Section>
        <Text>
          I’m reaching out regarding the{' '}
          <a href={engagementUrl}>{languageName}</a> project{' '}
          {language.ethnologue.name.value}, which has recently indicated
          reaching All Access goals. Our records identify you as the Field
          Project Manager (FPM), and we’d like to confirm the next steps for
          uploading the text to the Digital Bible Library (DBL).
        </Text>
        {products.map((product) => (
          <Text>{product.name}</Text>
        ))}
        <Text>
          To move forward, we need a few details from you. Please have your
          field partner complete this short form to provide the necessary
          information indicated below:
        </Text>
      </Section>
      <Section>
        <Head>✅ First Step: Who will upload the Scripture to the DBL?</Head>
        <Text>
          1. If someone is already responsible for uploading to the DBL, please
          let us know on the form so we can update our records and avoid
          unnecessary follow-ups.
        </Text>
        <Text>
          2. If you need Seed Company to upload it to the DBL, we will need
          additional information.
        </Text>
      </Section>
      <Section>
        <Head>✅ If Seed Company uploads to the DBL, please provide:</Head>
        <Text>
          🔹 Copyright Holder & Licensing – Who will hold the copyright for this
          text in DBL?
        </Text>
        <Text>
          The copyright holder can be the field partner or Seed Company if
          needed.
        </Text>
        <Text>
          We also need to confirm the licensing options you prefer for
          distribution. More details on these options are included in the
          attached information sheet.
        </Text>
      </Section>
      <Section>
        <Text>
          🔹 Error-Free Text in Paratext – The text must pass Basic Checks in
          Paratext without errors.
        </Text>
        <Text>
          A quick way to verify is by printing the text to PDF format using
          PTXPrint (learn here). Besides, our Investors love to see your
          progress and this is a great way to share it with them! 😊
        </Text>
        <Text>If errors appear, they must be fixed before we can proceed.</Text>
      </Section>
      <Section>
        <Text>
          🔹 Paratext Project Access – We need access to the project in
          Paratext.
        </Text>
        <Text>
          Please add SC DBL Admin to the project with the Consultant/Archivist
          role.
        </Text>
        <Text>
          This permission level is required for us to complete the upload.
        </Text>
      </Section>
      <Section>
        <Text>
          🔹 Books Ready for Upload – Please confirm which books are ready for
          DBL.
        </Text>
        <Text>
          We can upload an entire testament or individual books that have
          completed consultant checking.
        </Text>
      </Section>
      <Section>
        <Head>
          🔗{' '}
          <a href="https://forms.monday.com/forms/7c34605cdaedd9f47918540a0761d821?r=use1">
            Seed Company DBL Publication Request Form
          </a>
        </Head>
      </Section>
      <Section>
        <Text>
          All of this information can be entered in the form linked above (with
          yellow highlight). Please review the attached information sheet for
          additional details about the DBL, the process, and licensing options.
        </Text>
        <Text>Let me know if you have any questions—I’m happy to assist!</Text>
        <Text>Best regards, Darcie</Text>
      </Section>
    </EmailTemplate>
  );
}
