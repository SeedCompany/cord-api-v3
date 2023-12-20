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
      default := <default::User>(global default::currentUserId);
    };
    required modifiedBy: default::User {
      default := <default::User>(global default::currentUserId);
      rewrite update using (<default::User>(global default::currentUserId));
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
