CREATE MIGRATION m146fzf6hhpimpivjwcus4r6zr3onj2rygzw7f4qtni3yvcunlfv2a
    ONTO m1uvuqdzrjlvsf6g6caqgswsczfl2ior55flcx3j6klxacgfgclyqa
{
  CREATE MODULE Notification IF NOT EXISTS;
  CREATE ABSTRACT TYPE default::Notification EXTENDING Mixin::Audited;
  CREATE ABSTRACT TYPE Notification::Comment EXTENDING default::Notification {
      CREATE REQUIRED LINK comment: Comments::Comment {
          ON TARGET DELETE DELETE SOURCE;
      };
  };
  CREATE TYPE Notification::Recipient {
      CREATE REQUIRED LINK notification: default::Notification {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE PROPERTY readAt: std::datetime;
  };
  ALTER TYPE default::Notification {
      CREATE LINK recipients := (.<notification[IS Notification::Recipient]);
      CREATE SINGLE LINK currentRecipient := (std::assert_single((SELECT
          .recipients
      FILTER
          (.user = GLOBAL default::currentUser)
      )));
      CREATE PROPERTY readAt := (.currentRecipient.readAt);
      CREATE PROPERTY unread := (NOT (EXISTS (.currentRecipient.readAt)));
  };
  CREATE TYPE Notification::CommentViaMembership EXTENDING Notification::Comment;
  CREATE TYPE Notification::CommentViaMention EXTENDING Notification::Comment;
  CREATE TYPE Notification::System EXTENDING default::Notification {
      CREATE REQUIRED PROPERTY message: std::str;
  };
};
