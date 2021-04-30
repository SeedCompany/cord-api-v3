import { registerEnumType } from '@nestjs/graphql';

export enum ReportType {
  Financial = 'Financial',
  Progress = 'Progress',
  Narrative = 'Narrative',
}

registerEnumType(ReportType, { name: 'ReportType' });
