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
 * Valid actions for child One-to-Many relationships
 */
export type ChildListAction = 'read' | 'create' | 'delete';

/**
 * Valid actions for child One-to-One relationships
 */
export type ChildSingleAction = 'read' | 'edit';

/**
 * Probably don't use directly
 * @internal
 */
export type AnyAction = ResourceAction | PropAction | ChildRelationshipAction;
