import { type EnumType, makeEnum } from '@seedcompany/nest';

/**
 * Valid actions for resources
 */
export type ResourceAction = EnumType<typeof ResourceAction>;
export const ResourceAction = makeEnum(['read', 'edit', 'create', 'delete']);

/**
 * Valid actions for properties
 */
export type PropAction = EnumType<typeof PropAction>;
export const PropAction = makeEnum(['read', 'edit']);

/**
 * Valid actions for child relationships
 */
export type ChildRelationshipAction = EnumType<typeof ChildRelationshipAction>;
export const ChildRelationshipAction = makeEnum(['read', 'create', 'delete']);

/**
 * Valid actions for child One-to-Many relationships
 */
export type ChildListAction = EnumType<typeof ChildListAction>;
export const ChildListAction = makeEnum(['read', 'create', 'delete']);

/**
 * Valid actions for child One-to-One relationships
 */
export type ChildSingleAction = EnumType<typeof ChildSingleAction>;
export const ChildSingleAction = makeEnum(['read', 'edit']);

/**
 * Probably don't use directly
 * @internal
 */
export type AnyAction = EnumType<typeof AnyAction>;
export const AnyAction = makeEnum([...ResourceAction, ...PropAction, ...ChildRelationshipAction]);
