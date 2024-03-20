module Comments {
  abstract type Aware extending default::Resource {
    commentThreads := .<container[is Thread];

    access policy CanReadGeneratedFromAppPoliciesForCommentable
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForCommentable
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForCommentable
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }

  type Thread extending default::Resource, Mixin::Embedded, Mixin::Owned {
    overloaded required single link container: Aware {
      on target delete delete source;
    };
    comments := .<thread[is Comment];
    firstComment := (select .comments order by .createdAt asc limit 1);
    latestComment := (select .comments order by .createdAt desc limit 1);

    access policy CanReadGeneratedFromAppPoliciesForCommentThread
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
    access policy CanCreateGeneratedFromAppPoliciesForCommentThread
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForCommentThread
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Leadership', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
  }

  type Comment extending default::Resource, Mixin::Owned {
    required thread: Thread {
      on target delete delete source;
    };
    required body: default::RichText;

    access policy CanReadGeneratedFromAppPoliciesForComment
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
    access policy CanCreateGeneratedFromAppPoliciesForComment
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForComment
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
        or (exists (<default::Role>{'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Leadership', 'Liaison', 'Marketing', 'Mentor', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator'} intersect default::currentUser.roles) and (.isOwner ?? false))
    );
  }
}
