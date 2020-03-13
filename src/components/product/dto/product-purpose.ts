import { registerEnumType } from '@nestjs/graphql';

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
