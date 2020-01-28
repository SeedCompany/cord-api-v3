import { Field, ObjectType } from 'type-graphql';
import { Editable, Readable, Resource } from '../../../../common';
import { registerEnumType } from 'type-graphql';

export enum Degree {
  Primary = 'primary',
  Secondary = 'secondary',
  Associates = 'associates',
  Bachelors = 'bachelors',
  Masters = 'masters',
  Doctorate = 'doctorate',
}

registerEnumType(Degree, { name: 'Degree' });

@ObjectType({
  implements: [Readable, Editable],
})
export class Education extends Resource implements Readable, Editable {
  @Field()
  readonly degree: Degree;

  @Field()
  readonly major: string;

  @Field()
  readonly institution: string;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}
