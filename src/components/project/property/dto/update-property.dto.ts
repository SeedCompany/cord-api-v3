import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../../common';
import { Property } from './property.dto';

@InputType()
export abstract class UpdateProperty {
  @IdField()
  readonly id: string;

  @Field()
  readonly value?: string;
}

@InputType()
export abstract class UpdatePropertyInput {
  @Field()
  @Type(() => UpdateProperty)
  @ValidateNested()
  readonly property: UpdateProperty;
}

@ObjectType()
export abstract class UpdatePropertyOutput {
  @Field()
  readonly property: Property;
}
