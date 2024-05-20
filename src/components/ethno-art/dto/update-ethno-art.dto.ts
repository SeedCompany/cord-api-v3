import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '~/common';
import { ScriptureField, ScriptureRangeInput } from '../../scripture/dto';
import { EthnoArt } from './ethno-art.dto';

@InputType()
export abstract class UpdateEthnoArt {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[];
}

@InputType()
export abstract class UpdateEthnoArtInput {
  @Field()
  @Type(() => UpdateEthnoArt)
  @ValidateNested()
  readonly ethnoArt: UpdateEthnoArt;
}

@ObjectType()
export abstract class UpdateEthnoArtOutput {
  @Field()
  readonly ethnoArt: EthnoArt;
}
