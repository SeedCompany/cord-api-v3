module default {
  abstract type Notification extending Mixin::Audited {
    readAt := .currentRecipient.readAt; 
    unread := not exists .currentRecipient.readAt;
    single currentRecipient := assert_single((
      select .recipients filter .user = global currentUser
    ));
    recipients := .<notification[is Notification::Recipient];
  }
}

module Notification {
  type Recipient {
    required notification: default::Notification {
      on target delete delete source;
    };
    required user: default::User {
      on target delete delete source;
    };

    readAt: datetime;
  }

  type System extending default::Notification {
    required message: str;
  }
  abstract type Comment extending default::Notification {
    required comment: Comments::Comment {
      on target delete delete source;
    };
  }
  type CommentViaMention extending Comment;
  type CommentViaMembership extending Comment;
}
