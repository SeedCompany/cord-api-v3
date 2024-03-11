module Comments {
  abstract type Aware extending default::Resource {
    commentThreads := .<container[is default::Thread];
  }

  type Thread extending Resource, Mixin::Embedded, Mixin::Owned {
    overloaded required single link container: Aware {
      on target delete delete source;
    };
    comments := .<thread[is Comment];
    firstComment := (select .comments order by .createdAt asc limit 1);
    latestComment := (select .comments order by .createdAt desc limit 1);
  }

  type Comment extending Resource, Mixin::Owned {
    required body: default::RichText;
    required thread: Thread {
      on target delete delete source;
    };
  }
}