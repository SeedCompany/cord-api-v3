module default {
  type Directory extending File::Node {
    annotation description := "\
      A directory as you'd expect in a filesystem.
    ";
    
    required totalFiles: int32 {
      default := 0;
      rewrite insert, update using (count(.descendants[is File]));
    };
    
    overloaded size {
      rewrite insert, update using (sum(.descendants[is File].size));
    };
  }
  
  type File extending File::Node {
    annotation description := "\
      A \"file\" like you'd expect in a filesystem.
      But, here it's actually just a container for `File::Version`s, and fronts the info of the latest version.
      These are mutable in the sense that new versions can be added.
      There are no actual files stored with this directly, only with file versions.
    ";
    
    required latestVersion: File::Version {
      rewrite insert, update using (
        select .children[is File::Version]
        order by .createdAt desc
        limit 1
      );
    };
    
    mimeType: str {
      rewrite insert, update using (.latestVersion.mimeType);
    };
    
    overloaded size {
      rewrite insert, update using (.latestVersion.size ?? 0);
    };

    single media := .latestVersion.<file[is Media];
  }
}
  
module File {
  type Version extending Node {
    annotation description := "\
      An immutable version of a \"file\" backed by an actual file in storage.";
    
    required storageId: str {
      annotation description := "The id/path of this file in our storage (S3 Bucket).";
    };
    
    required mimeType: str {
      readonly := true;
    }; 
    overloaded size {
      constraint expression on (__subject__ > 0);
    };
    
    index on (.createdAt);
    
    trigger enforceImmutable after update for each do (
      assert(
        __old__.size = __new__.size,
        message := "File Versions are immutable."
      )
    );
    trigger enforceLeafNode after insert, update for each do (
      assert(
        count(__new__.children) = 0,
        message := "File Versions are leaf nodes and cannot have children."
      )
    );
  }
  
  abstract type Node extending default::Resource, Mixin::Named, Mixin::Embedded {
    overloaded container {
      on target delete delete source;
    }

    # TODO how to default to parent?
    # optional to have tri-state. idk if needed but that's what I implemented in neo4j
    public: bool;

    # Recursive :/ Need to refresh ancestors in app code. Luckily, I think all of the hard stuff is here in the schema,
    # so we just have to bump them to trigger the rewrites, as seen below.
#     trigger refreshAncestors after insert, update for each do (
#       update __new__.parents union __old__.parents
#       set {
#         modifiedAt := datetime_of_transaction(),
#         modifiedBy := <default::User>(global default::currentUserId)
#       }
#     );
#     WIP:
#     trigger refreshDescendants after insert, update for each do (
#       update __new__.descendants union __old__.descendants
#       set { parentIds := {} }
#     );
    
    required size: int64 {
      default := 0;
    };
    
    multi children: Node {
      on source delete delete target;
      on target delete allow;
    };
    
    single parent := assert_single(.<children[is Node]);
    
    # No recursive support yet. Fake with 10 level depth limit.
    # This union-ing appears to be slow, so we are doing it as a "stored computed" with this rewrite.
    # Rewrites are not currently supported on multi links. Hence the additional work around storing as an ID array.
    # That array is hydrated back into multi link nodes on read.
    # There should be no need to to reference the ID array directly.
    # https://github.com/edgedb/edgedb/issues/5016 ?
    # https://github.com/edgedb/edgedb/issues/5265
    parents := assert_distinct(<File::Node>array_unpack(.parentIds));
    parentIds: array<uuid> {
      rewrite insert, update using (
        with p := (
         select .parent
          union .parent.parent
          union .parent.parent.parent
          union .parent.parent.parent.parent
          union .parent.parent.parent.parent.parent
          union .parent.parent.parent.parent.parent.parent
          union .parent.parent.parent.parent.parent.parent.parent
          union .parent.parent.parent.parent.parent.parent.parent.parent
          union .parent.parent.parent.parent.parent.parent.parent.parent.parent
          union .parent.parent.parent.parent.parent.parent.parent.parent.parent.parent
        )
        select array_agg(p.id)
      );
    };
    
    descendants := assert_distinct(<File::Node>array_unpack(.descendantIds));
    descendantIds: array<uuid> {
      rewrite insert, update using (
        with c := (
         select .children
          union .children.children
          union .children.children.children
          union .children.children.children.children
          union .children.children.children.children.children
          union .children.children.children.children.children.children
          union .children.children.children.children.children.children.children
          union .children.children.children.children.children.children.children.children
          union .children.children.children.children.children.children.children.children.children
          union .children.children.children.children.children.children.children.children.children.children
        )
        select array_agg(c.id)
      );
    };
    
    # Also stored with a rewrite for performance.
    root: Node {
      rewrite insert, update using (<File::Node>array_get(.parentIds, -1));
    };
    
    trigger enforceUniqueNameWithinDirectory after insert, update for each do (
      assert(
        __new__.parent is default::Directory
          and count((select __new__.parent.children filter .name = __new__.name)) <= 1,
        message := "Directory (" ++ <str>__new__.parent.id ++ ") already has a node with this name \"" ++ __new__.name ++ "\"."
      )
    );
  }
}
