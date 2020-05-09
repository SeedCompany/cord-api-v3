import { registerEnumType } from '@nestjs/graphql';

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}
registerEnumType(Order, {
  name: 'Order',
  description: 'A sort order either ascending or descending',
});
