import { InternalRole, Role as ProjectRole } from '../dto';
import { TypeToDto, TypeToSecuredProps } from './mapping';

export enum Perm {
  Read = 1,
  // Can change property or create new relationships
  Edit = 2,
  Delete = 4,
  // helper for a common case
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member
  ReadAndEdit = Read | Edit,
}

export const hasPerm = (perm: Perm | null | undefined, check: Perm) =>
  ((perm ?? 0) & check) === check;

type Role = ProjectRole | InternalRole;

export type Policy<Type extends keyof TypeToDto> = (
  objectType: Type,
  roleToCheck: Role,
  obj: TypeToDto[Type]
) => Partial<Record<TypeToSecuredProps[Type], Perm>>;

type Conditions<Type extends keyof TypeToDto> = (
  obj: TypeToDto[Type]
) => boolean;
type GetPermissions<Type extends keyof TypeToDto> =
  | ((obj: TypeToDto[Type]) => Permissions<Type>)
  | Permissions<Type>;

export type Permissions<Type extends keyof TypeToDto> = Partial<
  Record<TypeToSecuredProps[Type], Perm>
>;

export function policy<Type extends keyof TypeToDto>(
  objectType: Type,
  role: Role,
  perms: GetPermissions<Type>
): Policy<Type>;
export function policy<Type extends keyof TypeToDto>(
  objectType: Type,
  role: Role,
  conditions: Conditions<Type>,
  perms: GetPermissions<Type>
): Policy<Type>;
export function policy<Type extends keyof TypeToDto>(
  objectType: Type,
  role: Role,
  condOrPerms: Conditions<Type> | GetPermissions<Type>,
  maybePerms?: GetPermissions<Type>
): Policy<Type> {
  return (
    objectTypeToCheck: Type,
    roleToCheck: Role,
    obj?: TypeToDto[Type]
  ): Permissions<Type> => {
    const conditions = maybePerms
      ? (condOrPerms as Conditions<Type>)
      : undefined;
    const perms = maybePerms ?? (condOrPerms as GetPermissions<Type>);

    if (objectType !== objectTypeToCheck || role !== roleToCheck) {
      return {};
    }

    if (conditions && (!obj || !conditions(obj))) {
      return {};
    }

    if (typeof perms === 'function') {
      return obj ? perms(obj) : {};
    }

    return perms;
  };
}

export const policyExecutor = (policies: Array<Policy<any>>) => <
  Type extends keyof TypeToDto
>(
  objectType: Type,
  role: Role,
  obj?: TypeToDto[Type]
) =>
  policies
    .map((policy) => policy(objectType, role, obj))
    .reduce((merged: Permissions<any>, perms) => {
      for (const [key, value] of Object.entries(perms) as Array<
        [keyof typeof perms, Perm]
      >) {
        merged[key] = value | (merged[key] ?? 0);
      }
      return merged;
    }, {});
