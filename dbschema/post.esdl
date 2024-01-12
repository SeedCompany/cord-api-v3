module default {
  type Post extending Resource, Mixin::Embedded, Mixin::Owned {
    # https://github.com/edgedb/edgedb/issues/6695
    # overloaded required single link container: Mixin::Postable
    overloaded required single link container {
      on target delete delete source;
    };
    trigger enforcePostable after insert, update for each do (
      assert(
        __new__.container is Mixin::Postable,
        message := "A Post's container must be a Postable"
      )
    );
    
    required type: Post::Type;
    required shareability: Post::Shareability;
    required body: RichText;
    
    single property sensitivity := .container[is Project::ContextAware].sensitivity;
    single property isMember := .container[is Project::ContextAware].isMember;
  }
}
  
module Mixin {
  abstract type Postable extending default::Resource {
    posts := .<container[is default::Post];
  }
}
  
module Post {
  scalar type Type extending enum<Note, Story, Prayer>;
  scalar type Shareability extending enum<Membership, Internal, AskToShareExternally, External>;
}
