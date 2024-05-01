module default {
  type Post extending Resource, Mixin::Embedded {
    overloaded required single link container: Mixin::Postable {
      on target delete delete source;
    };
    
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
