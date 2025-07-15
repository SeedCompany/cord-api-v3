import { type NonEmptyArray } from '@seedcompany/common';
import {
  Column,
  Text as Head,
  Section,
  Text,
} from '@seedcompany/nestjs-email/templates';
import type { Verse } from '@seedcompany/scripture';
import type { Range } from '~/common';
import { EmailTemplate } from '~/core/email/templates/base';
import { useFrontendUrl } from '~/core/email/templates/frontend-url';
import { LanguageRef } from '~/core/email/templates/user-ref';
import { type Engagement } from '../../../components/engagement/dto';
import { type Language } from '../../../components/language/dto';
import { type Project } from '../../../components/project/dto';
import { type User } from '../../../components/user/dto';

interface Props {
  recipient: User;
  project: Pick<Project, 'id' | 'name'>;
  engagement: Pick<Engagement, 'id'>;
  language: Pick<Language, 'id' | 'name' | 'ethnologue'>;
  completedBooks: NonEmptyArray<Range<Verse>>;
  dblFormUrl: string;
}

export function DBLUpload(props: Props) {
  const { language, project, completedBooks, engagement, dblFormUrl } = props;
  const languageName = language.name.value;
  return (
    <EmailTemplate title={`${languageName || 'Language'} needs a DBL upload`}>
      <Section>
        <Column>
          <Text>
            <LanguageRef {...language} /> has recently indicated reaching some
            All Access goals via{' '}
            <a href={useFrontendUrl(`/engagements/${engagement.id}`)}>
              {project.name.value ?? 'Some Project'}
            </a>
            .
          </Text>
          <Text>
            Books:{' '}
            {completedBooks.map((range) => range.start.book.name).join(', ')}
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
          <Text>
            Our records identify you as the Field Project Manager (FPM), and
            we’d like to confirm the next steps for uploading the text to the
            Digital Bible Library (DBL).
          </Text>
          <Text>
            To move forward, we need a few details from you. Please have your
            field partner complete this short form to provide the necessary
            information indicated below:
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
          <Head>✅ First Step: Who will upload the Scripture to the DBL?</Head>
          <Text>
            1. If someone is already responsible for uploading to the DBL,
            please let us know on the form so we can update our records and
            avoid unnecessary follow-ups.
          </Text>
          <Text>
            2. If you need Seed Company to upload it to the DBL, we will need
            additional information.
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
          <Head>✅ If Seed Company uploads to the DBL, please provide:</Head>
          <Text>
            🔹 Copyright Holder & Licensing – Who will hold the copyright for
            this text in DBL?
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
        </Column>
      </Section>
      <Section>
        <Column>
          <Text>
            🔹 Error-Free Text in Paratext – The text must pass Basic Checks in
            Paratext without errors.
          </Text>
          <Text>
            A quick way to verify is by printing the text to PDF format using
            PTXPrint (
            <a href="https://software.sil.org/ptxprint/">learn here</a>).
            Besides, our Investors love to see your progress and this is a great
            way to share it with them! 😊
          </Text>
          <Text>
            If errors appear, they must be fixed before we can proceed.
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
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
        </Column>
      </Section>
      <Section>
        <Column>
          <Text>
            🔹 Books Ready for Upload – Please confirm which books are ready for
            DBL.
          </Text>
          <Text>
            We can upload an entire testament or individual books that have
            completed consultant checking.
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
          <Head>
            🔗{' '}
            <a href={dblFormUrl} style={{ backgroundColor: 'yellow' }}>
              Seed Company DBL Publication Request Form
            </a>
          </Head>
          <Text>
            All of this information can be entered in the form linked above
            (with yellow highlight).
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
          <Head>
            🔗{' '}
            <a href={useFrontendUrl('/pdfs/dbl-uploads.pdf')}>
              Seed Company DBL Information Sheet
            </a>
          </Head>
          <Text>
            Please review the linked information sheet for additional details
            about the DBL, the process, and licensing options.
          </Text>
        </Column>
      </Section>
      <Section>
        <Column>
          <Text>
            Let me know if you have any questions—I’m happy to assist!
          </Text>
          <Text>Best regards, Darcie</Text>
        </Column>
      </Section>
    </EmailTemplate>
  );
}
