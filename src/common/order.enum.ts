import { EnumType, makeEnum } from './make-enum';

export type Order = EnumType<typeof Order>;
export const Order = makeEnum({
  name: 'Order',
  description: 'A sort order either ascending or descending',
  values: ['ASC', 'DESC'],
});
