import {
  Field,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  InternshipDomain,
  InternshipPosition,
  InternshipProgram,
  SecuredInternPosition,
} from './dto';

@ObjectType()
class InternshipPositionOptions {
  @Field(() => InternshipProgram)
  program: InternshipProgram;

  @Field(() => InternshipDomain, {
    nullable: true,
  })
  domain: InternshipDomain | null;

  @Field(() => InternshipPosition)
  position: InternshipPosition;
}

@Resolver(SecuredInternPosition)
export class InternshipPositionResolver {
  @ResolveField(() => [InternshipPositionOptions], {
    description:
      'The available position options for the internship engagement.',
  })
  options(): InternshipPositionOptions[] {
    return InternshipPosition.entries
      .filter((position) => !position.deprecationReason)
      .map((position) => ({
        position: position.value,
        domain: position.domain ?? null,
        program: position.program!,
      }));
  }

  @ResolveField(() => InternshipDomain, {
    nullable: true,
    description: 'The InternshipDomain based on the currently selected `value`',
  })
  domain(
    @Parent() { value: position }: SecuredInternPosition,
  ): InternshipDomain | null {
    const domain = InternshipPosition.entries.find(
      (entry) => position === entry.value,
    )?.domain;
    return position && domain ? domain : null;
  }

  @ResolveField(() => InternshipProgram, {
    nullable: true,
    description:
      'The InternshipProgram based on the currently selected `value`',
  })
  program(
    @Parent() { value: position }: SecuredInternPosition,
  ): InternshipProgram | null {
    const program = InternshipPosition.entries.find(
      (entry) => position === entry.value,
    )?.program;
    return position && program ? program : null;
  }
}
