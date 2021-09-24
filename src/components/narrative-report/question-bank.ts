import { negate } from 'lodash';
import { fiscalQuarter } from '../../common';
import { LanguageEngagement } from '../engagement/dto';
import { QuestionBankEntry } from '../question-answer/dto';
import { NarrativeReport } from './dto';

export const getBank = (): readonly Entry[] => [
  {
    category: 'Team Update',
    question: 'Biographies of team members',
    filter: isFirstReport,
  },
  {
    category: 'Team Update',
    question: 'Personal Updates of team members',
    filter: negate(isFirstReport),
  },
  {
    category: 'Team Update',
    question:
      'General update on team (Testimony, Biography, Personal reflection of a challenge or success, etc.)',
  },
  {
    category: 'Impact of Work',
    question: 'Narrative, Stories, & Stats',
  },
  {
    category: 'Impact of Work',
    question:
      'Story about partner interaction, achievement, challenge, gathering, etc.',
  },
  {
    category: 'Prayer Update',
    question: 'Answers',
  },
  {
    category: 'Prayer Update',
    question: 'New Requests',
  },
  {
    category: 'Prayer Update',
    question: 'Update on past requests',
  },
  {
    category: 'Translation Example',
    question: 'Reference',
  },
  {
    category: 'Translation Example',
    question: 'Translation',
  },
  {
    category: 'Annual Highlight',
    question: 'What went well',
    filter: isQuarter(3),
  },
  {
    category: 'Annual Highlight',
    question: `What didn't go well`,
    filter: isQuarter(3),
  },
  {
    category: 'Annual Highlight',
    question: 'What was learned',
    filter: isQuarter(3),
  },
  {
    category: 'Annual Highlight',
    question: 'What was learned',
    filter: isQuarter(3),
  },
  {
    category: 'Annual Highlight',
    question: 'Goals for next year',
    filter: isQuarter(3),
  },
];

type EntryFilter = (param: {
  report: NarrativeReport;
  eng: LanguageEngagement;
}) => boolean;
type Entry = QuestionBankEntry & { filter?: EntryFilter };

const isFirstReport: EntryFilter = ({ report, eng }) =>
  eng.startDate.value?.endOf('quarter').toMillis() === report.end.toMillis();

const isQuarter =
  (quarter: number): EntryFilter =>
  ({ report }) =>
    fiscalQuarter(report.start) === quarter;
