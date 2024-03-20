module default {
  type Post extending Resource, Mixin::Embedded, Mixin::Owned {
    overloaded required single link container: Mixin::Postable {
      on target delete delete source;
    };
    
    required type: Post::Type;
    required shareability: Post::Shareability;
    required body: RichText;
    
    single property sensitivity := .container[is Project::ContextAware].sensitivity;
    single property isMember := .container[is Project::ContextAware].isMember;

    access policy CanSelectGeneratedFromAppPoliciesForPost
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect (<default::User>(global default::currentUserId)).roles)
        or (.isOwner ?? false)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForPost
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPost
    allow delete using (
      (
        default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
        or (.isOwner ?? false)
      )
    );
  }
}
  
module Mixin {
  abstract type Postable extending default::Resource {
    posts := .<container[is default::Post];

    access policy CanSelectGeneratedFromAppPoliciesForPostable
    allow select using (
      exists (<default::Role>{'Administrator', 'Leadership'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanInsertGeneratedFromAppPoliciesForPostable
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPostable
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );
  }
}
  
module Post {
  scalar type Type extending enum<Note, Story, Prayer>;
  scalar type Shareability extending enum<Membership, Internal, AskToShareExternally, External>;
}
