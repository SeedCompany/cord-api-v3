import { Field, InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

@InterfaceType({
  description: stripIndent`
    A secured object. This object is not an entity, but rather a wrapper object
    containing a real value and metadata for the current user.
  `,
})
abstract class Secured {
  @Field({
    description: 'Whether the current user can read the value',
  })
  canRead: boolean;
}

// Don't confuse GQL interface with our TS Shape
export { Secured as ISecured };
