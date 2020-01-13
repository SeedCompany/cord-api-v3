import { BibleBook } from './bible-book';
import { ProductApproach } from './approach';
import { ProductMedium } from './medium';
import { ProductMethodology } from './methodology';
import { ProductPurpose } from './purpose';
import { ProductType } from './type';

export interface Product {
  id: string;
  name: ProductType;
  books: BibleBook[];
  mediums: ProductMedium[];
  purposes: ProductPurpose[];
  approach: ProductApproach;
  methodology: ProductMethodology;
}
