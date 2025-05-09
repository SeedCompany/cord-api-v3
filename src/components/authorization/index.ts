export * from './policy';
export {
  type HasCreator,
  type HasScope,
  type HasSensitivity,
  type HasVariant,
  withEffectiveSensitivity,
  withMembershipRoles,
  withScope,
  withVariant,
} from './policies/conditions';
