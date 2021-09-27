import { fiscalQuarter } from '../../common';
import { LanguageEngagement } from '../engagement/dto';
import { QuestionBank } from '../question-answer/dto';
import { NarrativeReport } from './dto';

export const getBank = ({
  report,
  eng,
}: {
  report: NarrativeReport;
  eng: LanguageEngagement;
}): QuestionBank => {
  const isFirstReport =
    eng.startDate.value?.endOf('quarter').toMillis() === report.end.toMillis();

  return {
    categories: [
      {
        name: 'Team Update',
        entries: [
          {
            question: isFirstReport
              ? 'Biographies of team members'
              : 'Personal Updates of team members',
          },
          {
            question:
              'General update on team (Testimony, Biography, Personal reflection of a challenge or success, etc.)',
          },
        ],
      },
      {
        name: 'Impact of Work',
        entries: [
          {
            question: 'Narrative, Stories, & Stats',
          },
          {
            question:
              'Story about partner interaction, achievement, challenge, gathering, etc.',
          },
        ],
      },
      {
        name: 'Prayer Update',
        entries: [
          {
            question: 'Answers',
          },
          {
            question: 'New Requests',
          },
          {
            question: 'Update on past requests',
          },
        ],
      },
      {
        name: 'Translation Example',
        entries: [
          {
            question: 'Reference',
          },
          {
            question: 'Translation',
          },
        ],
      },
      ...(fiscalQuarter(report.start) === 3
        ? [
            {
              name: 'Annual Highlight',
              entries: [
                {
                  question: 'What went well',
                },
                {
                  question: `What didn't go well`,
                },
                {
                  question: 'What was learned',
                },
                {
                  question: 'What was learned',
                },
                {
                  question: 'Goals for next year',
                },
              ],
            },
          ]
        : []),
    ],
  };
};
