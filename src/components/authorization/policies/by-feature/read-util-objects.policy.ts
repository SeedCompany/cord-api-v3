import { Policy } from '../util';

@Policy('all', (r) => [
  r.Location.read,
  r.Producible.read,
  r.Product.none, // Products extend Producibles but don't want to give read access to them.
])
export class ReadUtilObjectsPolicy {}
