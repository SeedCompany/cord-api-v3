import {
  fiscalQuarter,
  fiscalYear,
  type ID,
  type RichTextDocument,
} from '~/common';
import {
  EmailTemplate,
  FormattedDateTime,
  Heading,
  Mjml,
  ProjectRef,
  useFrontendUrl,
  UserRef,
  type UserRefProps,
} from '~/core/email';
import { type Project } from '../../../project/dto';
import { type User } from '../../../user/dto';
import { fullName } from '../../../user/fullName';
import { type GTLReport, GtlReportStatus } from '../../dto';
import { type GtlReportWorkflowEvent } from '../dto/workflow-event.dto';

export interface GtlReportStatusChangedProps {
  /** Absent when the actor cannot be shown (a system agent, or unreadable). */
  changedBy?: UserRefProps;
  recipient: Pick<
    User,
    'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  project: Pick<Project, 'id' | 'name'>;
  /** The leader the report is about — the engagement's intern. */
  leader: UserRefProps;
  engagement: { id: ID };
  report: Pick<GTLReport, 'id' | 'start'>;
  newStatusVal: GtlReportStatus;
  previousStatusVal: GtlReportStatus;
  /** Secured for the recipient — `notes` shows only when they may read it. */
  workflowEvent: GtlReportWorkflowEvent;
}

export function GtlReportStatusChanged({
  changedBy,
  recipient,
  project,
  leader,
  engagement,
  report,
  newStatusVal,
  previousStatusVal,
  workflowEvent,
}: GtlReportStatusChangedProps) {
  const projectName = project.name.value || '';
  const leaderName = fullName(leader) ?? '';
  // The web app has no page for a GTL report yet, so the link lands on the
  // engagement the report hangs off (the DBL upload email does the same).
  // Point this at the report's own route once cord-field defines one.
  const reportUrl = useFrontendUrl(`/engagements/${engagement.id}`);
  const reportLabel = `GTL Report - Q${fiscalQuarter(report.start)} FY${fiscalYear(
    report.start,
  )}`;

  const oldStatus = GtlReportStatus.entry(previousStatusVal).label;
  const newStatus = GtlReportStatus.entry(newStatusVal).label;

  const notes = workflowEvent.notes.canRead
    ? paragraphsOf(workflowEvent.notes.value)
    : [];

  return (
    <EmailTemplate
      title={`${leaderName} (${projectName}) ${reportLabel} changed from ${oldStatus} to ${newStatus}`}
    >
      <Heading>
        {reportLabel} is now <em>{newStatus}</em>
      </Heading>

      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text paddingBottom={16}>
            {changedBy ? (
              <>
                <UserRef {...changedBy} /> has changed{' '}
                <a href={reportUrl}>{reportLabel}</a>{' '}
              </>
            ) : (
              <>
                <a href={reportUrl}>{reportLabel}</a> changed{' '}
              </>
            )}
            from <em>{oldStatus}</em> to <em>{newStatus}</em> for{' '}
            <UserRef {...leader} /> in <ProjectRef {...project} /> on{' '}
            {/* A recipient with no recorded timezone falls back to the
                component's own default, same as one who never set it. */}
            <FormattedDateTime
              value={workflowEvent.at}
              timezone={recipient.timezone.value ?? undefined}
            />
          </Mjml.Text>
          {notes.length > 0 ? (
            <>
              <Mjml.Text paddingBottom={4}>
                <strong>Notes</strong>
              </Mjml.Text>
              {notes.map((paragraph, index) => (
                <Mjml.Text key={index} paddingTop={0} paddingBottom={8}>
                  {paragraph}
                </Mjml.Text>
              ))}
            </>
          ) : null}
          <Mjml.Button href={reportUrl} paddingTop={16}>
            View {reportLabel}
          </Mjml.Button>
        </Mjml.Column>
      </Mjml.Section>
    </EmailTemplate>
  );
}

/**
 * The text of a block-editor document, one string per block, with inline
 * markup dropped. Enough for the short notes a reviewer leaves on a
 * transition; not a faithful rendering of the document.
 */
function paragraphsOf(doc: RichTextDocument | null | undefined): string[] {
  const blocks = (doc as { blocks?: unknown[] } | null | undefined)?.blocks;
  if (!Array.isArray(blocks)) {
    return [];
  }
  return blocks.flatMap((block) => {
    const data = (block as { data?: Record<string, unknown> }).data;
    if (!data) {
      return [];
    }
    const texts: unknown[] = [];
    if (typeof data.text === 'string') {
      texts.push(data.text);
    }
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        texts.push(
          typeof item === 'string'
            ? item
            : (item as { content?: unknown })?.content,
        );
      }
    }
    return texts.flatMap((text) => {
      if (typeof text !== 'string') {
        return [];
      }
      const plain = text
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      return plain ? [plain] : [];
    });
  });
}
