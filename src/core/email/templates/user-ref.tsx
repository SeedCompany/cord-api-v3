import type { User } from '../../../components/user/dto';
import { fullName } from '../../../components/user/fullName';
import { useFrontendUrl } from './frontend-url';

export type UserRefProps = Pick<User, 'id'> & Parameters<typeof fullName>[0];

export const UserRef = (props: UserRefProps) => {
  const url = useFrontendUrl(`/users/${props.id}`);
  return <a href={url}>{fullName(props) ?? 'Someone'}</a>;
};
