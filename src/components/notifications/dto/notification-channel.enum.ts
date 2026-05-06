import { type EnumType, makeEnum } from '@seedcompany/nest';

export type NotificationChannel = EnumType<typeof NotificationChannel>;
export const NotificationChannel = makeEnum({
  name: 'NotificationChannel',
  description: 'The delivery channels available for notifications',
  values: ['App'],
});

export type ChannelAvailability = EnumType<typeof ChannelAvailability>;
export const ChannelAvailability = makeEnum({
  name: 'NotificationChannelAvailability',
  values: ['AlwaysOn', 'DefaultOn', 'DefaultOff', 'AlwaysOff'],
  extra: (ca) => ({
    resolve: (
      availability: EnumType<typeof ca>,
      override: boolean | undefined,
    ) => {
      if (availability === 'AlwaysOn') return true;
      if (availability === 'AlwaysOff') return false;
      return override ?? availability === 'DefaultOn';
    },
    isConfigurable: (availability: EnumType<typeof ca>) =>
      availability === 'DefaultOn' || availability === 'DefaultOff',
  }),
});
