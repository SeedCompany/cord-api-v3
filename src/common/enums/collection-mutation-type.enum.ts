import { type EnumType, makeEnum } from '@seedcompany/nest';

export type CollectionMutationType = EnumType<typeof CollectionMutationType>;
export const CollectionMutationType = makeEnum({
  name: 'CollectionMutationType',
  description: 'The type of mutation that occurred to a collection',
  values: [
    { value: 'Added', description: 'Items added to this collection' },
    { value: 'Removed', description: 'Items removed from this collection' },
    // A future implementation.
    // Possibly items have an `order/position` property.
    // A mutation could change that float number.
    // initial values could be gapped by 100s
    // position change could take the midpoint between the two surrounding items points.
    // {
    //   value: 'Reordered',
    //   description: 'Items in this collection whose order changed',
    // },
  ],
});
