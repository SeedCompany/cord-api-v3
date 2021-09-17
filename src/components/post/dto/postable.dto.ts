import { InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField } from '../../../common';

@InterfaceType({
  description: stripIndent`
    An object that can be used to enable Post discussions on a Node.
  `,
})
export abstract class Postable {
  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;
}
