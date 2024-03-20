module default {
  type Directory extending File::Node {
    # TODO how to update
    required totalFiles: int32 {
      default := 0;
    };

    access policy CanReadGeneratedFromAppPoliciesForDirectory
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Controller', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForDirectory
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForDirectory
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
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

    access policy CanReadGeneratedFromAppPoliciesForFileVersion
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForFileVersion
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForFileVersion
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
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

    access policy CanReadGeneratedFromAppPoliciesForFileNode
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForFileNode
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForFileNode
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
}
