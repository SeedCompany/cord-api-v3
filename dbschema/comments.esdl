module Comments {
  abstract type Aware extending default::Resource {
    commentThreads := .<container[is Thread];

    access policy CanSelectGeneratedFromAppPoliciesForCommentable
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForCommentable
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForCommentable
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }

  type Thread extending default::Resource, Mixin::Embedded, Mixin::Owned {
    overloaded required single link container: Aware {
      on target delete delete source;
    };
    comments := .<thread[is Comment];
    firstComment := (select .comments order by .createdAt asc limit 1);
    latestComment := (select .comments order by .createdAt desc limit 1);

    access policy CanSelectGeneratedFromAppPoliciesForCommentThread
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

    access policy CanInsertGeneratedFromAppPoliciesForCommentThread
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForCommentThread
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

  type Comment extending default::Resource, Mixin::Owned {
    required thread: Thread {
      on target delete delete source;
    };
    required body: default::RichText;

    access policy CanSelectGeneratedFromAppPoliciesForComment
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

    access policy CanInsertGeneratedFromAppPoliciesForComment
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForComment
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
