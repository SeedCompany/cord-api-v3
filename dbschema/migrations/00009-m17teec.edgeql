CREATE MIGRATION m17teecxqpduefkkjxf64pokydi5e2ztcip6ayk23fvm6snddjbksa
    ONTO m146fzf6hhpimpivjwcus4r6zr3onj2rygzw7f4qtni3yvcunlfv2a
{
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForComment
          ALLOW DELETE USING (.isCreator);
  };
  ALTER TYPE Comments::Comment {
      DROP ACCESS POLICY CanSelectUpdateReadDeleteGeneratedFromAppPoliciesForComment;
  };
  ALTER TYPE Comments::Comment {
      CREATE ACCESS POLICY CanSelectUpdateReadInsertGeneratedFromAppPoliciesForComment
          ALLOW SELECT, UPDATE READ, INSERT ;
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForCommentThread
          ALLOW DELETE USING (.isCreator);
  };
  ALTER TYPE Comments::Thread {
      DROP ACCESS POLICY CanSelectUpdateReadDeleteGeneratedFromAppPoliciesForCommentThread;
  };
  ALTER TYPE Comments::Thread {
      CREATE ACCESS POLICY CanSelectUpdateReadInsertGeneratedFromAppPoliciesForCommentThread
          ALLOW SELECT, UPDATE READ, INSERT ;
  };
};
