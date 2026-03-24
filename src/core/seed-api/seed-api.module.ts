import { Global, Module } from '@nestjs/common';
import { SeedApiService } from './seed-api.service';

@Global()
@Module({
  providers: [SeedApiService],
  exports: [SeedApiService],
})
export class SeedApiModule {}
