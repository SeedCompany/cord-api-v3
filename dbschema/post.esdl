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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          exists (<default::Role>{'Administrator', 'Leadership'} intersect givenRoles)
          or (.isOwner ?? false)
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForPost
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPost
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        (
          default::Role.Administrator in givenRoles
          or (.isOwner ?? false)
        )
      )
    );
  }
}
  
module Mixin {
  abstract type Postable extending default::Resource {
    posts := .<container[is default::Post];

    access policy CanSelectGeneratedFromAppPoliciesForPostable
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForPostable
    allow insert, delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
}
  
module Post {
  scalar type Type extending enum<Note, Story, Prayer>;
  scalar type Shareability extending enum<Membership, Internal, AskToShareExternally, External>;
}
