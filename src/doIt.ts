/* eslint-disable no-console */
import { INestApplicationContext } from '@nestjs/common';
import {
  asyncIteratorToArray,
  cmpBy,
  entries,
  groupToMapBy,
  mapValues,
  setOf,
} from '@seedcompany/common';
import { greaterEqualTo, node, relation } from 'cypher-query-builder';
import fs from 'fs/promises';
import { CalendarDate, fiscalQuarterLabel, UnsecuredDto } from '~/common';
import { DatabaseService } from '~/core/database';
import { ACTIVE, matchProps, merge } from '~/core/database/query';
import { Language } from './components/language/dto';
import type { PnpProblem } from './components/pnp/extraction-result';
import type { ProgressReport } from './components/progress-report/dto';
import { createPaginator } from './components/progress-report/migrations/reextract-all-progress-reports.migration';
import { Project } from './components/project/dto';

function problemCounts(rows: readonly Row[]) {
  const occurrencesByType = mapValues(
    groupToMapBy(
      rows.flatMap((row) => row.problems),
      problemType,
    ),
    (_, v) => v.length,
  ).asMap;
  console.log('got occurrences by type');
  const existsInAReportByType = rows
    .map(({ problems }) => {
      return setOf(problems.map(problemType));
    })
    .reduce((countOfType, current) => {
      for (const problem of current) {
        countOfType.set(problem, (countOfType.get(problem) ?? 0) + 1);
      }
      return countOfType;
    }, new Map<string, number>());
  console.log('got existances by type');

  const out = entries(existsInAReportByType)
    .map(([problem, count]) => ({
      problem,
      existsInXReports: count,
      occurrencesInAllReports: occurrencesByType.get(problem)!,
    }))
    .toSorted(
      cmpBy([
        [(x) => x.existsInXReports, 'desc'],
        [(x) => x.occurrencesInAllReports, 'desc'],
      ]),
    );
  console.log('built array');
  return out;
}

function unknownStepLabelCounts(rows: readonly Row[]) {
  const counts = rows
    .flatMap((row) => row.problems)
    .filter((problem) => {
      return problem.groups[1] === 'The step header label is non standard';
    })
    .map((problem) => {
      const stepLabel = problem.message.match(/^"((?:.|\n)*)"/)![1];
      return stepLabel;
    })
    .reduce((countOfSteps, step) => {
      countOfSteps.set(step, (countOfSteps.get(step) ?? 0) + 1);
      return countOfSteps;
    }, new Map<string, number>());

  return entries(counts)
    .map(([step, count]) => ({
      step,
      count,
    }))
    .toSorted(cmpBy([(x) => x.count, 'desc']));
}

function unknownStepLabels(rows: readonly Row[]) {
  return rows.flatMap((row) => {
    const { problems, report, language, project, partner } = row;
    return problems
      .filter((problem) => {
        return problem.groups[1] === 'The step header label is non standard';
      })
      .map((problem) => {
        const stepLabel = problem.message.match(/^"((?:.|\n)*)"/)![1];
        return {
          step: stepLabel,
          quarter: fiscalQuarterLabel(
            CalendarDate.fromISO(report.start as any),
          ),
          languageName: language.name,
          languageUrl: `https://cordfield.com/languages/` + language.id,
          projectName: project.name,
          projectUrl: `https://cordfield.com/projects/` + project.id,
          partnerName: partner.name,
          partnerUrl: `https://cordfield.com/partners/` + partner.id,
          reportUrl: `https://cordfield.com/progress-reports/` + report.id,
        };
      });
  });
}

function problemCountsByReport(rows: readonly Row[]) {
  return rows.flatMap((row) => {
    const { problems, report, language, project, partner } = row;

    const existsInAReportByType = problems.reduce(
      (countOfType: Record<string, number>, current) => {
        const type = problemType(current);
        countOfType[type] = (countOfType[type] ?? 0) + 1;
        return countOfType;
      },
      {},
    );

    return {
      quarter: fiscalQuarterLabel(CalendarDate.fromISO(report.start as any)),
      languageName: language.name,
      languageUrl: `https://cordfield.com/languages/` + language.id,
      projectName: project.name,
      projectUrl: `https://cordfield.com/projects/` + project.id,
      partnerName: partner.name,
      partnerUrl: `https://cordfield.com/partners/` + partner.id,
      reportUrl: `https://cordfield.com/progress-reports/` + report.id,
      ...existsInAReportByType,
    };
  });
}

export const doIt = async (app: INestApplicationContext) => {
  const rows = await fsCached('problems.json', async () => {
    const db = app.get(DatabaseService);
    const rows$ = createPaginator((page) => grabPage(db, page));
    const rows = await asyncIteratorToArray(rows$);
    return rows;
  });
  console.log('loaded json');

  await writeJson('problem-counts.json', problemCounts(rows));
  await writeJson(
    'unknown-step-label-counts.json',
    unknownStepLabelCounts(rows),
  );
  await writeJson('unknown-step-labels.json', unknownStepLabels(rows));
  await writeJson('problem-counts-by-report.json', problemCountsByReport(rows));
};

interface Row {
  problems: PnpProblem[];
  report: UnsecuredDto<ProgressReport>;
  language: UnsecuredDto<Pick<Language, 'id' | 'name'>>;
  project: UnsecuredDto<Pick<Project, 'id' | 'name'>>;
  partner: UnsecuredDto<Pick<Project, 'id' | 'name'>>;
}

const grabPage = async (db: DatabaseService, page: number) => {
  console.log('grabbing page', page);
  return await db
    .query()
    .match([
      node('reportNode', 'ProgressReport'),
      relation('out'),
      node('', 'File'),
      relation('out'),
      node('result', 'PnpExtractionResult'),
    ])
    .raw(`WHERE result.hasNotice or result.hasWarning or result.hasError`)
    .apply(matchProps({ nodeName: 'reportNode', outputVar: 'report' }))
    .with('*')
    .where({
      'report.start': greaterEqualTo(CalendarDate.local(2021, 10)),
    })
    .with('*')
    .match([
      [
        node('languageName', 'Property'),
        relation('in', '', 'name', ACTIVE),
        node('language', 'Language'),
        relation('in', '', 'language'),
        node('engagement', 'LanguageEngagement'),
        relation('out', '', 'report', ACTIVE),
        node('reportNode'),
      ],
      [
        node('engagement'),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
        relation('out', '', 'name', ACTIVE),
        node('projectName', 'Property'),
      ],
    ])
    .subQuery('project', (sub) =>
      sub
        .optionalMatch([
          node('project'),
          relation('out', '', 'partnership', ACTIVE),
          node('partnership', 'Partnership'),
          relation('out', '', 'types', ACTIVE),
          node('types', 'Property'),
        ])
        .raw(`WHERE "Managing" in types.value`)
        .with('partnership')
        .limit(1)
        .match([
          node('partnership'),
          relation('out', '', 'partner'),
          node('partner', 'Partner'),
          relation('out', '', 'organization'),
          node('organization', 'Organization'),
          relation('out', '', 'name', ACTIVE),
          node('orgName', 'Property'),
        ])
        .return(merge('partner', { name: 'orgName.value' }).as('partner')),
    )
    .logIt()
    .return<Row>([
      'partner',
      merge('language', { name: 'languageName.value' }).as('language'),
      merge('project', { name: 'projectName.value' }).as('project'),
      'report',
      'apoc.convert.fromJsonList(result.problems) as problems',
    ])
    .skip(page * 1000)
    .limit(1000)
    .run();
};

const problemType = (problem: PnpProblem) =>
  problem.groups[1] ?? problem.message;

const fsCached = async <T>(
  filename: string,
  calculate: () => Promise<T>,
): Promise<T> => {
  try {
    return await readJson(filename);
  } catch (e) {
    // fall
  }
  const res = await calculate();
  await writeJson(filename, res);
  return res;
};

async function writeJson(filename: string, out: unknown) {
  await fs.writeFile(filename, JSON.stringify(out, undefined, 2));
}
async function readJson(filename: string) {
  const raw = await fs.readFile(filename, 'utf-8');
  return JSON.parse(raw);
}
