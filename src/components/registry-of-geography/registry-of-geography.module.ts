import { Module } from '@nestjs/common';
import { RegistryOfGeographyResolver } from './registry-of-geography.resolver';
import { RegistryOfGeographyService } from './registry-of-geography.service';

@Module({
  providers: [RegistryOfGeographyResolver, RegistryOfGeographyService],
  exports: [RegistryOfGeographyService],
})
export class RegistryOfGeographyModule {}
