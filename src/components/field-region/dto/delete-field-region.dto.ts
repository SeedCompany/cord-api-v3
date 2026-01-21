import { ObjectType } from '@nestjs/graphql';
import { MutationPlaceholderOutput } from '~/common';

@ObjectType()
export abstract class FieldRegionDeleted extends MutationPlaceholderOutput {}
