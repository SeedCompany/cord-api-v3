import { type NonEmptyArray } from '@seedcompany/common';
import type { Verse } from '@seedcompany/scripture';
import type { Range } from '~/common';
import {
  EmailTemplate,
  Headers,
  LanguageRef,
  Mjml,
  useConfig,
  useFrontendUrl,
  useResources,
} from '~/core/email';
import type { LanguageEngagement } from '../../engagement/dto';
import type { Language } from '../../language/dto';
import type { Project } from '../../project/dto';

interface Props {
  engagement: LanguageEngagement;
  language: Language;
  project: Project;
  completedBooks: NonEmptyArray<Range<Verse>>;
}

export async function DBLUpload(props: Omit<Props, 'language' | 'project'>) {
  const { engagement } = props;

  const resources = useResources();
  const [language, project] = await Promise.all([
    resources.load('Language', engagement.language.value!.id),
    resources.load('Project', engagement.project.id),
  ]);
  return <DBLUploadTemplate {...props} project={project} language={language} />;
}

function DBLUploadTemplate(props: Props) {
  const { engagement, completedBooks, project, language } = props;

  const config = useConfig().email.notifyDblUpload!;

  const languageName = language.name.value;
  return (
    <EmailTemplate title={`${languageName || 'Language'} needs a DBL upload`}>
      {config.replyTo && <Headers replyTo={config.replyTo} />}
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            <LanguageRef {...language} /> has recently indicated reaching some
            All Access goals via{' '}
            <a href={useFrontendUrl(`/engagements/${engagement.id}`)}>
              {project.name.value ?? 'Some Project'}
            </a>
            .
          </Mjml.Text>
          <Mjml.Text>
            Books:{' '}
            {completedBooks.map((range) => range.start.book.name).join(', ')}
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            Our records identify you as the Field Project Manager (FPM), and
            we’d like to confirm the next steps for uploading the text to the
            Digital Bible Library (DBL).
          </Mjml.Text>
          <Mjml.Text>
            To move forward, we need a few details from you. Please have your
            field partner complete this short form to provide the necessary
            information indicated below:
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            ✅ First Step: Who will upload the Scripture to the DBL?
          </Mjml.Text>
          <Mjml.Text>
            1. If someone is already responsible for uploading to the DBL,
            please let us know on the form so we can update our records and
            avoid unnecessary follow-ups.
          </Mjml.Text>
          <Mjml.Text>
            2. If you need Seed Company to upload it to the DBL, we will need
            additional information.
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            ✅ If Seed Company uploads to the DBL, please provide:
          </Mjml.Text>
          <Mjml.Text>
            🔹 Copyright Holder & Licensing – Who will hold the copyright for
            this text in DBL?
          </Mjml.Text>
          <Mjml.Text>
            The copyright holder can be the field partner or Seed Company if
            needed.
          </Mjml.Text>
          <Mjml.Text>
            We also need to confirm the licensing options you prefer for
            distribution. More details on these options are included in the
            attached information sheet.
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            🔹 Error-Free Text in Paratext – The text must pass Basic Checks in
            Paratext without errors.
          </Mjml.Text>
          <Mjml.Text>
            A quick way to verify is by printing the text to PDF format using
            PTXPrint (
            <a href="https://software.sil.org/ptxprint/">learn here</a>).
            Besides, our Investors love to see your progress and this is a great
            way to share it with them! 😊
          </Mjml.Text>
          <Mjml.Text>
            If errors appear, they must be fixed before we can proceed.
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            🔹 Paratext Project Access – We need access to the project in
            Paratext.
          </Mjml.Text>
          <Mjml.Text>
            Please add SC DBL Admin to the project with the Consultant/Archivist
            role.
          </Mjml.Text>
          <Mjml.Text>
            This permission level is required for us to complete the upload.
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            🔹 Books Ready for Upload – Please confirm which books are ready for
            DBL.
          </Mjml.Text>
          <Mjml.Text>
            We can upload an entire testament or individual books that have
            completed consultant checking.
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            🔗{' '}
            <a href={config.formUrl} style={{ backgroundColor: 'yellow' }}>
              Seed Company DBL Publication Request Form
            </a>
          </Mjml.Text>
          <Mjml.Text>
            All of this information can be entered in the form linked above
            (with yellow highlight).
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text>
            🔗{' '}
            <a href={useFrontendUrl('/pdfs/dbl-uploads.pdf')}>
              Seed Company DBL Information Sheet
            </a>
          </Mjml.Text>
          <Mjml.Text>
            Please review the linked information sheet for additional details
            about the DBL, the process, and licensing options.
          </Mjml.Text>
        </Mjml.Column>
      </Mjml.Section>
    </EmailTemplate>
  );
}
