import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { ProductStepRepository } from './product-step.repository';
import { ProductStepResolver } from './product-step.resolver';
import { ProductStepService } from './product-step.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [ProductStepRepository, ProductStepService, ProductStepResolver],
  exports: [ProductStepRepository, ProductStepService],
})
export class ProductStepModule {}
