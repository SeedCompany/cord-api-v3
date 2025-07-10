import { useModuleRef } from '@seedcompany/nestjs-email/templates';
import { DateTime, type Zone } from 'luxon';
import { ConfigService } from '~/core';

type ZoneLike = string | Zone;

export interface FormattedDateTimeProps {
  value: DateTime;
  timezone?: ZoneLike;
}

export const FormattedDateTime = (props: FormattedDateTimeProps) => {
  const config = useModuleRef().get(ConfigService);
  const formatted = props.value
    .setZone(props.timezone ?? config.defaultTimeZone)
    .toLocaleString(DateTime.DATETIME_FULL);
  return <>{formatted}</>;
};
