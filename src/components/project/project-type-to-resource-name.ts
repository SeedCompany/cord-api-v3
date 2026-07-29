import { type ProjectType } from './dto/project-type.enum';

/**
 * Maps a `ProjectType` to its concrete GraphQL object-type name — needed
 * whenever a Drizzle repository builds a BaseNode-shaped `parent` for
 * `ChangesetAwareResolver.parent()` (which expects `labels: [concreteName]`,
 * not the abstract `Project` interface — `resourceResolver.doResolveType()`
 * rejects that with "Could not determine GraphQL object from type: Project"
 * since it isn't a GraphQLObjectType). Extracted here once several
 * Postgres/Drizzle repositories needed the identical mapping (originally
 * inlined in `BudgetDrizzleRepository`).
 */
export const projectTypeToResourceName = (type: ProjectType): string =>
  ({
    MomentumTranslation: 'MomentumTranslationProject',
    MultiplicationTranslation: 'MultiplicationTranslationProject',
    Internship: 'InternshipProject',
  })[type];
