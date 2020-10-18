import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), FundingAccountModule],
  providers: [LocationResolver, LocationService],
  exports: [LocationService],
})
export class LocationModule {}
