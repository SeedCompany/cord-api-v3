import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UserModule } from '../../user/user.module';
import { PropertyResolver } from './property.resolver';
import { PropertyService } from './property.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [PropertyResolver, PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
