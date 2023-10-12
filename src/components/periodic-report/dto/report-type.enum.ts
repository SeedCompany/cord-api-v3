import { EnumType, makeEnum } from '~/common';

export type ReportType = EnumType<typeof ReportType>;
export const ReportType = makeEnum({
  name: 'ReportType',
  values: ['Financial', 'Progress', 'Narrative'],
});
