import { type EnumType, makeEnum } from '@seedcompany/nest';

export type Sensitivity = EnumType<typeof Sensitivity>;
export const Sensitivity = makeEnum({
  name: 'Sensitivity',
  values: ['Low', 'Medium', 'High'],
  exposeOrder: true,
});
