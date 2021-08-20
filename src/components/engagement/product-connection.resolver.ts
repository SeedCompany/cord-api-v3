import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { Product } from '../product';
import { LanguageEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(Product)
export class EngagementProductConnectionResolver {
  constructor(private readonly engagements: EngagementService) {}

  @ResolveField(() => LanguageEngagement)
  async engagement(
    @Parent() product: Product,
    @AnonSession() session: Session
  ) {
    return await this.engagements.readOne(product.engagement, session);
  }
}
