import { type Language } from '../../../components/language/dto';
import { type Project } from '../../../components/project/dto';
import type { User } from '../../../components/user/dto';
import { fullName } from '../../../components/user/fullName';
import { useFrontendUrl } from './frontend-url';

export type UserRefProps = Pick<User, 'id'> & Parameters<typeof fullName>[0];

export const UserRef = (props: UserRefProps) => {
  const url = useFrontendUrl(`/users/${props.id}`);
  return <a href={url}>{fullName(props) ?? 'Someone'}</a>;
};

export type LanguageRefProps = Pick<Language, 'id' | 'name'>;

export const LanguageRef = (props: LanguageRefProps) => {
  const url = useFrontendUrl(`/languages/${props.id}`);
  return <a href={url}>{props.name.value ?? 'Some Language'}</a>;
};

export type ProjectRefProps = Pick<Project, 'id' | 'name'>;

export const ProjectRef = (props: ProjectRefProps) => {
  const url = useFrontendUrl(`/projects/${props.id}`);
  return <a href={url}>{props.name.value ?? 'Some Project'}</a>;
};
