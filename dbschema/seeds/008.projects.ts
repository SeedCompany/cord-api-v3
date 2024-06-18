import { entries, mapValues } from '@seedcompany/common';
import type { e } from '~/core/edgedb';
import type { SeedFn } from '~/core/edgedb/seeds.run';

const momentumTranslation: Input[] = [
  {
    name: 'Misty Mountains',
    step: 'EarlyConversations',
    mouStart: '2020-01-01',
    mouEnd: '2023-12-30',
    estimatedSubmission: '2023-12-01',
    financialReportPeriod: 'Monthly',
  },
  {
    name: 'Arnor Lake',
    step: 'FinalizingProposal',
    mouStart: '2015-01-01',
    mouEnd: '2018-12-30',
    estimatedSubmission: '2022-12-01',
    financialReportPeriod: 'Monthly',
  },
  {
    name: 'Lothlorien',
    step: 'Active',
    mouStart: '2020-01-01',
    mouEnd: '2025-05-30',
    primaryLocation: 'Greece',
    financialReportPeriod: 'Quarterly',
  },
  {
    name: 'Emyn Muil',
    step: 'Active',
    mouStart: '2019-03-01',
    mouEnd: '2022-10-30',
    primaryLocation: 'India',
    financialReportPeriod: 'Quarterly',
  },
  {
    name: 'South Downs',
    step: 'FinalizingCompletion',
    mouStart: '2020-01-01',
    mouEnd: '2023-12-30',
    estimatedSubmission: '2023-09-01',
    primaryLocation: 'United States',
    financialReportPeriod: 'Monthly',
  },
];

const internships: Input[] = [
  {
    name: 'Glorfindel - Exegetical Facilitator',
    step: 'DiscussingChangeToPlan',
    mouStart: '2021-07-01',
    mouEnd: '2024-12-30',
    primaryLocation: 'Sweden',
    estimatedSubmission: '2024-10-01',
    financialReportPeriod: 'Monthly',
  },
  {
    name: 'Arwen Evenstar Intern',
    step: 'PendingConceptApproval',
    mouStart: '2022-10-01',
    mouEnd: '2025-12-30',
    financialReportPeriod: 'Quarterly',
  },
  {
    name: 'Eomer of Rohan Intern',
    step: 'Active',
    mouStart: '2022-02-01',
    mouEnd: '2026-06-30',
    primaryLocation: 'Egypt',
    financialReportPeriod: 'Monthly',
  },
  {
    name: 'Cohort of the Ents',
    step: 'PendingFinancialEndorsement',
    mouStart: '2022-02-01',
    mouEnd: '2026-06-30',
    financialReportPeriod: 'Quarterly',
  },
  {
    name: 'Barliman Butterbur Intern',
    step: 'OnHoldFinanceConfirmation',
    mouStart: '2018-02-01',
    mouEnd: '2022-07-30',
    primaryLocation: 'Canada',
    financialReportPeriod: 'Monthly',
  },
];

interface Input {
  name: string;
  step: (typeof e.Project.Step)['__tstype__'];
  mouStart: string;
  mouEnd: string;
  financialReportPeriod: (typeof e.ReportPeriod)['__tstype__'];
  primaryLocation?: string;
  estimatedSubmission?: string;
}

export default (async function ({ e, db, print }) {
  const existing = new Set(await e.select(e.Project).name.run(db));

  const projectSeeds = entries({
    MomentumTranslation: momentumTranslation,
    Internship: internships,
  }).flatMap(([type, list]) => list.map((item) => ({ type, ...item })));

  const newProjects = projectSeeds.filter((t) => !existing.has(t.name));
  if (newProjects.length === 0) {
    return;
  }

  for (const { type, step, ...project } of newProjects) {
    const insertQ = e.insert(e[`${type}Project`], {
      ...project,
      ...mapValues.fromList(
        ['mouStart', 'mouEnd', 'estimatedSubmission'],
        (key, { SKIP }) =>
          !project[key] ? SKIP : e.cal.local_date(project[key]!),
      ).asRecord,
      primaryLocation: project.primaryLocation
        ? e.assert_exists(
            e.select(e.Location, () => ({
              filter_single: { name: project.primaryLocation! },
            })),
          )
        : undefined,
    });
    const query = e.select(insertQ, () => ({ id: true, projectContext: true }));
    const inserted = await query.run(db);

    // Update project to reference self for their context (has to be separate query)
    // https://github.com/edgedb/edgedb/issues/3960
    const projectRef = e.cast(e.Project, e.uuid(inserted.id));
    const pcQuery = e.update(e.select(projectRef).projectContext, () => ({
      set: { projects: projectRef },
    }));
    await pcQuery.run(db);

    if (step !== 'EarlyConversations') {
      await e
        .insert(e.Project.WorkflowEvent, {
          project: projectRef,
          projectContext: projectRef.projectContext,
          to: step,
        })
        .run(db);
    }
  }
  print({ 'Added Projects': newProjects.map((t) => t.name) });
} satisfies SeedFn);
