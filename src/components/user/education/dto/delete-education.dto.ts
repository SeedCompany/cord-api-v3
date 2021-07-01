import { ObjectType } from '@nestjs/graphql';
import { MutationPlaceholderOutput } from '../../../../common';

@ObjectType()
export abstract class DeleteEducationOutput extends MutationPlaceholderOutput {}
