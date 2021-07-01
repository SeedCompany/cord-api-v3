import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

/**
 * Use this class for delete output types when there are no other fields
 */
@ObjectType({ isAbstract: true })
export abstract class MutationPlaceholderOutput {
  @Field({
    deprecationReason: stripIndent`
      This operation will not return if there is a failure.
      Check the errors instead of using this field.
      If you need to reference a field in the output use \`__typename\` instead.
      This field will go away at any point in time without warning.
    `,
  })
  success: true;
}
