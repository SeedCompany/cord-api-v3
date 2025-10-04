import { DateTime, type Zone } from 'luxon';
import { useConfig } from './useConfig';

type ZoneLike = string | Zone;

export interface FormattedDateTimeProps {
  value: DateTime;
  timezone?: ZoneLike;
}

export const FormattedDateTime = (props: FormattedDateTimeProps) => {
  const config = useConfig();
  const formatted = props.value
    .setZone(props.timezone ?? config.defaultTimeZone)
    .toLocaleString(DateTime.DATETIME_FULL);
  return <>{formatted}</>;
};
