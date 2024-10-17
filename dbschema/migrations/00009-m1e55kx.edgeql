CREATE MIGRATION m1e55kxe33s565thv7ncvzvpxqtkxgdz7ligyo6xm5ltmtbnrcpfba
    ONTO m1pvo24aqhhami2ykpfps4sbyodmu4ewhs2jqiborpqrdlgkzvvvia
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
