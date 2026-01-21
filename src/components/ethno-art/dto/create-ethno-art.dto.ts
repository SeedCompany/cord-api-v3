import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { NameField } from '~/common';
import { ScriptureField, type ScriptureRangeInput } from '../../scripture/dto';
import { EthnoArt } from './ethno-art.dto';

@InputType()
export abstract class CreateEthnoArt {
  @NameField()
  readonly name: string;

  @ScriptureField({ nullable: true })
  readonly scriptureReferences?: readonly ScriptureRangeInput[] = [];
}

@ObjectType()
export abstract class EthnoArtCreated {
  @Field()
  readonly ethnoArt: EthnoArt;
}
