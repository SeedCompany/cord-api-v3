import { Field, InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { IdField } from './id-field';
import { DateTimeField } from './luxon.graphql';
import { SecuredProps } from './secured-property';
import { AbstractClassType } from './types';

@InterfaceType()
export abstract class Resource {
  @IdField()
  readonly id: string;

  @DateTimeField()
  readonly createdAt: DateTime;

  @Field({
    description: 'Whether the requesting user can delete this resource',
  })
  readonly canDelete: boolean;

  protected constructor() {
    // no instantiation, shape only
  }
}

export type ResourceShape<T> = AbstractClassType<T> & {
  Props: string[];
  SecuredProps: string[];
  Relations?: Record<string, any>;
};

// Get the secured props of the resource
// merged with all of the relations which are assumed to be secure.
export type SecuredResource<
  Resource extends ResourceShape<any>,
  IncludeRelations extends boolean | undefined = true
> = SecuredProps<Resource['prototype']> &
  (IncludeRelations extends false ? unknown : Resource['Relations']);
