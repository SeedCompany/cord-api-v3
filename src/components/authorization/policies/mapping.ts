import { ConditionalKeys } from 'type-fest';
import { Secured } from '../../../common';
import { Project, ProjectMember } from '../../project';
import { User } from '../../user/dto';

export interface TypeToDto {
  Project: Project;
  ProjectMember: ProjectMember;
  User: User;
  // Add more here as needed
}

type SecuredKeys<Dto extends Record<string, any>> = ConditionalKeys<
  Dto,
  Secured<any>
>;

export interface TypeToSecuredProps {
  Project:
    | SecuredKeys<Project>
    | 'rootDirectory'
    | 'member'
    | 'locations'
    | 'partnership'
    | 'budget';
  ProjectMember: SecuredKeys<ProjectMember>;
  User: SecuredKeys<User>;
  // Add more here as needed
}
