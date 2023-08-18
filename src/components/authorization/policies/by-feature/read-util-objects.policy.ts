import { Policy } from '../util';

@Policy('all', (r) => [
  r.Location.read,
  r.Producible.read,
  r.Product.none, // Products extend Producibles but don't want to give read access to them.

  // If anyone is able to read the post, then they can read its properties as well.
  // These are declared via `XPostable.children(c => c.posts.read)`
  r.Post.specifically((p) => p.many('body', 'creator').read),
])
export class ReadUtilObjectsPolicy {}
