/**
 * Valid actions for resources
 */
export type ResourceAction = 'read' | 'edit' | 'create' | 'delete';

/**
 * Valid actions for properties
 */
export type PropAction = 'read' | 'edit';

/**
 * Valid actions for child relationships
 */
export type ChildRelationshipAction = 'read' | 'create' | 'delete';

/**
 * Probably don't use directly
 * @internal
 */
export type AnyAction = ResourceAction | PropAction | ChildRelationshipAction;
