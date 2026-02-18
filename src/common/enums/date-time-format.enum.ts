import { type EnumType, makeEnum } from '@seedcompany/nest';

export type DateTimeFormat = EnumType<typeof DateTimeFormat>;
export const DateTimeFormat = makeEnum({
  name: 'DateTimeFormat',
  values: ['ISO', 'Human'],
});
