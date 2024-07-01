module default {
  type FieldRegion extending Resource, Mixin::Named {
    overloaded name {
      constraint exclusive;
    }
    
    required fieldZone: FieldZone;
    required director: User;
  }
}
