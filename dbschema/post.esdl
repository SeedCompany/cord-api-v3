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

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPost
    allow select, update read using (
      (
        exists (<Role>{'Administrator', 'Leadership'} intersect global currentRoles)
        or .isCreator
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForPost
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForPost
    allow insert using (
      Role.Administrator in global currentRoles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForPost
    allow delete using (
      (
        Role.Administrator in global currentRoles
        or .isCreator
      )
    );
  }
}
  
module Mixin {
  abstract type Postable extending default::Resource {
    posts := .<container[is default::Post];

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForPostable
    allow select, update read using (
      exists (<default::Role>{'Administrator', 'Leadership'} intersect global default::currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForPostable
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForPostable
    allow insert, delete using (
      default::Role.Administrator in global default::currentRoles
    );
  }
}
  
module Post {
  scalar type Type extending enum<Note, Story, Prayer>;
  scalar type Shareability extending enum<Membership, Internal, AskToShareExternally, External>;
}
