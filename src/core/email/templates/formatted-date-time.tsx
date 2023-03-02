import { DateTime, Settings, Zone } from 'luxon';
import { createContext, ReactElement, useContext } from 'react';

type ZoneLike = string | Zone;

export interface FormattedDateTimeProps {
  value: DateTime;
  timezone?: ZoneLike;
}

export const FormattedDateTime = (props: FormattedDateTimeProps) => {
  const defaultZone = useContext(DefaultTimezoneContext);
  const formatted = props.value
    .setZone(props.timezone ?? defaultZone)
    .toLocaleString(DateTime.DATETIME_FULL);
  return <>{formatted}</>;
};

const DefaultTimezoneContext = createContext<ZoneLike | undefined>(
  Settings.defaultZone,
);

export const DefaultTimezoneWrapper = (zone: ZoneLike) => (el: ReactElement) =>
  (
    <DefaultTimezoneContext.Provider value={zone}>
      {el}
    </DefaultTimezoneContext.Provider>
  );
