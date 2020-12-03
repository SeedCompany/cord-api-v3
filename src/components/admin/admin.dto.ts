import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GenericOut } from '../../core/database/v4/dto/GenericOut';

@InputType()
export class AdminInputDto {
  @Field()
  input: string;
}

@ObjectType()
export class AdminOutputDto {
  @Field({ nullable: true })
  success: true;
}

export class BootstrapIn {
  rootEmail: string;
  rootPash: string;
  defaultOrgName: string;
  defaultOrgId: string;
}

export class BootstrapOut extends GenericOut {
  rootAdminId: string;
}
