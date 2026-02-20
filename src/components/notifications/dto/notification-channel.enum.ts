import { type EnumType, makeEnum } from '@seedcompany/nest';

export type NotificationChannel = EnumType<typeof NotificationChannel>;
export const NotificationChannel = makeEnum({
  name: 'NotificationChannel',
  description: 'The delivery channels available for notifications',
  values: ['App'],
});
