import { registerEnumType } from 'type-graphql';

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
