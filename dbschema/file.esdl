module default {
  type Directory extending File::Node {
    # TODO how to update
    required totalFiles: int32 {
      default := 0;
    };

    access policy CanSelectGeneratedFromAppPoliciesForDirectory
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForDirectory
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForDirectory
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
  
  # TODO how to front latest version info?
  type File extending File::Node {
    required mimeType: str;
    required latestVersion: File::Version;

    single media := .latestVersion.<file[is Media];
  }
}
  
module File {
  type Version extending Node {
    required mimeType: str;

    access policy CanSelectGeneratedFromAppPoliciesForFileVersion
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForFileVersion
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForFileVersion
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
  
  abstract type Node extending default::Resource, Mixin::Named {
    # TODO how to default to parent?
    # optional to have tri-state. idk if needed but that's what I implemented in neo4j
    public: bool;
    
    required createdBy: default::User {
      default := default::currentUser;
    };
    required modifiedBy: default::User {
      default := default::currentUser;
      rewrite update using (default::currentUser);
      # TODO trigger change up the tree
      # TODO trigger re-eval on node delete?
    };
    
    # TODO trigger directories evaluate
    required size: int64;
    
    link parent: Node;
    multi link parents: Node {
      # a way to determine order?
      depth: int16; # todo enforce
    }
#     multi link children: Node;

    access policy CanSelectGeneratedFromAppPoliciesForFileNode
    allow select using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForFileNode
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForFileNode
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
}
