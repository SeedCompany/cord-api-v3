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

    access policy CanReadGeneratedFromAppPoliciesForPost
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
    access policy CanCreateGeneratedFromAppPoliciesForPost
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForPost
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Leadership', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
  }
}
  
module Mixin {
  abstract type Postable extending default::Resource {
    posts := .<container[is default::Post];

    access policy CanReadGeneratedFromAppPoliciesForPostable
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForPostable
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForPostable
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
}
  
module Post {
  scalar type Type extending enum<Note, Story, Prayer>;
  scalar type Shareability extending enum<Membership, Internal, AskToShareExternally, External>;
}
