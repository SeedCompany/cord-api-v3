import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { IdField } from '~/common';
import { Role } from '../../authorization';

@ObjectType()
export class Variant {
  @IdField({
    description: 'Use this field when communicating with the API',
  })
  key: string;

  @Field({
    description: 'Describe the variant to users with this field',
  })
  label: string;

  @Field(() => Role, {
    nullable: true,
    description: stripIndent`
      The main role _responsible_ for values of this variant.
      This does not necessarily imply who has access to this variant's values.
      The given role could have edit access or not, and other roles could be able
      to edit this variant's values as well.
    `,
  })
  responsibleRole?: Role;
}
