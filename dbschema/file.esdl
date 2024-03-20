module default {
  type Directory extending File::Node {
    # TODO how to update
    required totalFiles: int32 {
      default := 0;
    };

    access policy CanSelectGeneratedFromAppPoliciesForDirectory
    allow select using (
      exists (<default::Role>{'Administrator', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Leadership'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanInsertGeneratedFromAppPoliciesForDirectory
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForDirectory
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
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
      exists (<default::Role>{'Administrator', 'Leadership'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanInsertGeneratedFromAppPoliciesForFileVersion
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForFileVersion
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
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
      exists (<default::Role>{'Administrator', 'Leadership'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanInsertGeneratedFromAppPoliciesForFileNode
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForFileNode
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );
  }
}
