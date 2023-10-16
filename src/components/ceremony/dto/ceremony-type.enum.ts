import { EnumType, makeEnum } from '~/common';

export type CeremonyType = EnumType<typeof CeremonyType>;
export const CeremonyType = makeEnum({
  name: 'CeremonyType',
  values: [
    // Language Engagements can have dedications
    'Dedication',
    // Internship Engagements can have certifications
    'Certification',
  ],
});
