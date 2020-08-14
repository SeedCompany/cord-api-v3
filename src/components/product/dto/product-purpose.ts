import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

/**
 * Why is this translation happening?
 */
export enum ProductPurpose {
  EvangelismChurchPlanting = 'EvangelismChurchPlanting',
  ChurchLife = 'ChurchLife',
  ChurchMaturity = 'ChurchMaturity',
  SocialIssues = 'SocialIssues',
  Discipleship = 'Discipleship',
}

registerEnumType(ProductPurpose, {
  name: 'ProductPurpose',
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product purposes'),
})
export class SecuredProductPurposes extends SecuredEnumList(ProductPurpose) {}
