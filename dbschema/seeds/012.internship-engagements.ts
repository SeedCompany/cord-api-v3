import type { SeedFn } from '~/core/edgedb/seeds.run';
import { EngagementStatus } from '../../src/components/engagement/dto';

const engagementsInput: Input[] = [
  {
    project: 'Arwen Evenstar Intern',
    intern: 'Samwise',
    status: 'Completed',
    mentor: 'Gandalf',
    countryOfOrigin: 'New Zealand',
    startDateOverride: '2019-04-01',
    endDateOverride: '2020-06-30',
  },
  {
    project: 'Glorfindel - Exegetical Facilitator',
    intern: 'Frodo',
    status: 'DiscussingChangeToPlan',
    mentor: 'Bilbo',
    countryOfOrigin: 'New Zealand',
    startDateOverride: '2023-01-01',
    endDateOverride: '2024-07-22',
  },
  {
    project: 'Cohort of the Ents',
    intern: 'Meriadoc',
    status: 'Active',
  },
  {
    project: 'Barliman Butterbur Intern',
    intern: 'Peregrin',
    status: 'Suspended',
  },
  {
    project: 'Eomer of Rohan Intern',
    intern: 'Aragorn',
    status: 'FinalizingCompletion',
    countryOfOrigin: 'New Zealand',
  },
];

interface Input {
  project: string;
  intern: string;
  status: string;
  mentor?: string;
  countryOfOrigin?: string;
  startDateOverride?: string;
  endDateOverride?: string;
}

export default (async function ({ e, db, print }) {
  const existingInternshipEngagements = await e
    .select(e.InternshipEngagement, () => ({
      project: {
        name: true,
      },
      intern: {
        realFirstName: true,
      },
    }))
    .run(db);
  const newEngagements = engagementsInput.filter(
    (engagementSeed) =>
      !existingInternshipEngagements.some(
        (engagementData) =>
          engagementData.project.name === engagementSeed.project &&
          engagementData.intern.realFirstName === engagementSeed.intern,
      ),
  );

  if (newEngagements.length === 0) {
    return;
  }

  for (const { intern, project, status, ...engagement } of newEngagements) {
    const internQ = e.assert_exists(
      e.select(e.User, (item) => ({
        filter_single: e.op(item.realFirstName, '=', intern),
        ...e.User['*'],
      })),
    );

    const intershipProjectQ = e.assert_exists(
      e.select(e.InternshipProject, (item) => ({
        filter_single: e.op(item.name, '=', project),
        ...e.InternshipProject['*'],
      })),
    );

    const insertQ = e.insert(e.InternshipEngagement, {
      project: intershipProjectQ,
      projectContext: intershipProjectQ.projectContext,
      intern: internQ,
      startDateOverride: engagement.startDateOverride
        ? e.cal.local_date(engagement.startDateOverride)
        : undefined,
      endDateOverride: engagement.endDateOverride
        ? e.cal.local_date(engagement.endDateOverride)
        : undefined,
      mentor: engagement.mentor
        ? e.assert_exists(
            e.select(e.User, (user) => ({
              filter_single: e.op(user.realFirstName, '=', engagement.mentor!),
              ...e.User['*'],
            })),
          )
        : undefined,
      countryOfOrigin: engagement.countryOfOrigin
        ? e.assert_exists(
            e.select(e.Location, () => ({
              filter_single: { name: engagement.countryOfOrigin! },
              ...e.Location['*'],
            })),
          )
        : undefined,
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
    'Added InternshipEngagments': newEngagements.map(
      (engagement) => engagement.project + ' - ' + engagement.intern,
    ),
  });
} satisfies SeedFn);
