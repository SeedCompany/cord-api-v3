module Comments {
  abstract type Aware extending default::Resource {
    commentThreads := .<container[is Thread];

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForCommentable
    allow select, update read using (
      exists (<default::Role>{'Administrator', 'Leadership'} intersect global default::currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForCommentable
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForCommentable
    allow insert, delete using (
      default::Role.Administrator in global default::currentRoles
    );
  }

  type Thread extending default::Resource, Mixin::Embedded {
    overloaded required single link container: Aware {
      on target delete delete source;
    };
    comments := .<thread[is Comment];
    firstComment := (select .comments order by .createdAt asc limit 1);
    latestComment := (select .comments order by .createdAt desc limit 1);

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForCommentThread
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect global default::currentRoles)
        or .isCreator
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForCommentThread
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForCommentThread
    allow insert using (
      default::Role.Administrator in global default::currentRoles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForCommentThread
    allow delete using (
      (
        default::Role.Administrator in global default::currentRoles
        or .isCreator
      )
    );
  }

  type Comment extending default::Resource {
    required thread: Thread {
      on target delete delete source;
    };
    required body: default::RichText;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForComment
    allow select, update read using (
      (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect global default::currentRoles)
        or .isCreator
      )
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForComment
    allow update write;

    access policy CanInsertGeneratedFromAppPoliciesForComment
    allow insert using (
      default::Role.Administrator in global default::currentRoles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForComment
    allow delete using (
      (
        default::Role.Administrator in global default::currentRoles
        or .isCreator
      )
    );
  }
}
