import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import {
  PaginatedList,
  SecuredList,
  SecuredProperty,
  SortablePaginationInput,
} from '../../../common';
import { Ceremony } from './ceremony.dto';
import { CeremonyType } from './type.enum';

@InputType()
export abstract class CeremonyFilters {
  @Field(() => CeremonyType, {
    description: 'Only ceremonies of this type',
    nullable: true,
  })
  readonly type?: CeremonyType;
}

const defaultFilters = {};

@InputType()
export class CeremonyListInput extends SortablePaginationInput<
  keyof Ceremony | 'projectName' | 'languageName'
>({
  defaultSort: 'projectName',
}) {
  static defaultVal = new CeremonyListInput();

  @Field({ nullable: true })
  @Type(() => CeremonyFilters)
  @ValidateNested()
  readonly filter: CeremonyFilters = defaultFilters;
}

@ObjectType()
export class CeremonyListOutput extends PaginatedList(Ceremony) {}

@ObjectType({
  description: SecuredList.descriptionFor('ceremonies'),
})
export abstract class SecuredCeremonyList extends SecuredList(Ceremony) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a ceremony'),
})
export abstract class SecuredCeremony extends SecuredProperty(Ceremony) {}
