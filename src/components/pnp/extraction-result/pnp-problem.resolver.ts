import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PnpExtractionResult, PnpProblem } from './extraction-result.dto';

@Resolver(PnpExtractionResult)
export class PnpProblemResolver {
  @ResolveField(() => [PnpProblem])
  problems(@Parent() result: PnpExtractionResult) {
    return [...result.problems.values()].map((problem) =>
      PnpProblem.render(problem),
    );
  }
}
