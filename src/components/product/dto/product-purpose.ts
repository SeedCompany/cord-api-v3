import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredPropertyList } from '../../../common';

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
  description: SecuredPropertyList.descriptionFor('product purposes'),
})
export class SecuredProductPurposes extends SecuredPropertyList(
  ProductPurpose
) {}
