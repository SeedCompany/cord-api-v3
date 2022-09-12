/**
 * Valid actions for resources
 */
export type ResourceAction = 'read' | 'edit' | 'create' | 'delete';

/**
 * Valid actions for properties
 */
export type PropAction = 'read' | 'edit';

/**
 * Probably don't use directly
 * @internal
 */
export type AnyAction = ResourceAction | PropAction;
