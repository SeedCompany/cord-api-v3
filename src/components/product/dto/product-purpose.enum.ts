import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

/**
 * Why is this translation happening?
 */
export type ProductPurpose = EnumType<typeof ProductPurpose>;
export const ProductPurpose = makeEnum({
  name: 'ProductPurpose',
  description: 'Why is this translation happening?',
  values: [
    'EvangelismChurchPlanting',
    'ChurchLife',
    'ChurchMaturity',
    'SocialIssues',
    'Discipleship',
  ],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('product purposes'),
})
export class SecuredProductPurposes extends SecuredEnumList(ProductPurpose) {}
