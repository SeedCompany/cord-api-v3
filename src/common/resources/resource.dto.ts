import { Field, InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import type { OmitIndexSignature } from 'type-fest';
import { DbLabel } from '~/common/db';
import { IdField } from '~/common/graphql/fields/id.field';
import { DateTimeField } from '~/common/graphql/fields/temporal.field';
import { DataObject } from '~/common/graphql/objects/abstracts/data-object';
import { type ID } from '~/common/types';
import type { ScopedRole } from '../../components/authorization/dto';

// Merge with this to declare Relations types for Resources.
// Be sure to patch at runtime too.
// Don't reference this type directly, other than to declaration merge.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeclareResourceRelations {}

@InterfaceType()
@DbLabel('BaseNode')
export abstract class Resource extends DataObject {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static readonly Relations =
    (): OmitIndexSignature<DeclareResourceRelations> => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore -- runtime needs to be patched in.
      return {};
    };

  readonly __typename?: string;

  @IdField()
  readonly id: ID;

  @DateTimeField()
  readonly createdAt: DateTime;

  @Field({
    description: 'Whether the requesting user can delete this resource',
  })
  readonly canDelete: boolean;

  // A list of non-global roles the requesting user has available for this object.
  // This is used by the authorization module to determine permissions.
  readonly scope?: readonly ScopedRole[];
}
