module default {
  type Directory extending File::Node {
    # TODO how to update
    required totalFiles: int32 {
      default := 0;
    };
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
  }
}
