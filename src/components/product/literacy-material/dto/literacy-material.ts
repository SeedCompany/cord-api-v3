import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredPropertyList,
  SecuredString,
} from '../../../../common';
import { Range } from '../../range/dto';

@ObjectType({
  description: SecuredPropertyList.descriptionFor('literacymaterials'),
})
export abstract class SecuredLiteracyMaterialRange extends SecuredPropertyList(
  Range
) {}

@ObjectType({
  implements: Resource,
})
export class LiteracyMaterial extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (LiteracyMaterial as any) as Type<LiteracyMaterial>;

  @Field()
  readonly name: SecuredString;

  @Field(() => SecuredLiteracyMaterialRange, { nullable: true })
  readonly ranges: SecuredLiteracyMaterialRange;
}
