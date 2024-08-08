import type { SeedFn } from '~/core/edgedb/seeds.run';
import { EngagementStatus } from '../../src/components/engagement/dto';

const engagementsInput: Input[] = [
  {
    project: 'Misty Mountains',
    language: 'English',
    status: 'InDevelopment',
    startDateOverride: '2020-04-01',
    endDateOverride: '2020-06-30',
  },
  {
    project: 'Arnor Lake',
    language: 'Quenya',
    status: 'FinalizingCompletion',
    startDateOverride: '2016-04-01',
    endDateOverride: '2017-06-30',
  },
  {
    project: 'Lothlorien',
    language: 'Sindarin',
    status: 'Active',
  },
  {
    project: 'Emyn Muil',
    language: 'Khuzdul',
    status: 'Active',
  },
  {
    project: 'South Downs',
    language: 'Westron',
    status: 'FinalizingCompletion',
    paratextRegistryId: '1234567890',
  },
];

interface Input {
  project: string;
  language: string;
  status: string;
  startDateOverride?: string;
  endDateOverride?: string;
  paratextRegistryId?: string;
}

export default (async function ({ e, db, print }) {
  const existingLanguageEngagements = await e
    .select(e.LanguageEngagement, () => ({
      project: {
        name: true,
      },
      language: {
        name: true,
      },
    }))
    .run(db);
  const newEngagements = engagementsInput.filter(
    (engagementSeed) =>
      !existingLanguageEngagements.some(
        (engagementData) =>
          engagementData.project.name === engagementSeed.project &&
          engagementData.language.name === engagementSeed.language,
      ),
  );

  if (newEngagements.length === 0) {
    return;
  }

  for (const { language, project, status, ...engagement } of newEngagements) {
    const languageQ = e.assert_exists(
      e.select(e.Language, (item) => ({
        filter_single: e.op(item.displayName, '=', language),
        ...e.Language['*'],
      })),
    );

    const translationProjectQ = e.assert_exists(
      e.select(e.TranslationProject, (item) => ({
        filter_single: e.op(item.name, '=', project),
        ...e.TranslationProject['*'],
      })),
    );

    const insertQ = e.insert(e.LanguageEngagement, {
      project: translationProjectQ,
      projectContext: translationProjectQ.projectContext,
      startDateOverride: engagement.startDateOverride
        ? e.cal.local_date(engagement.startDateOverride)
        : undefined,
      endDateOverride: engagement.endDateOverride
        ? e.cal.local_date(engagement.endDateOverride)
        : undefined,
      language: languageQ,
      paratextRegistryId: engagement.paratextRegistryId,
    });
    const query = e.select(insertQ, () => ({ id: true, projectContext: true }));
    const inserted = await query.run(db);

    const engagementRef = e.cast(e.Engagement, e.uuid(inserted.id));

    if (status !== 'InDevelopment') {
      await e
        .insert(e.Engagement.WorkflowEvent, {
          engagement: engagementRef,
          projectContext: engagementRef.projectContext,
          to: status as EngagementStatus,
        })
        .run(db);
    }
  }
  print({
    'Added LanguageEngagments': newEngagements.map(
      (engagement) => engagement.project + ' - ' + engagement.language,
    ),
  });
} satisfies SeedFn);
