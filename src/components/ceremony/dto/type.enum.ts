import { registerEnumType } from '@nestjs/graphql';

export enum CeremonyType {
  // Language Engagements can have dedications
  Dedication = 'Dedication',
  // Internship Engagements can have certifications
  Certification = 'Certification',
}

registerEnumType(CeremonyType, {
  name: 'CeremonyType',
});
