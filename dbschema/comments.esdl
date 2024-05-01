module Comments {
  abstract type Aware extending default::Resource {
    commentThreads := .<container[is Thread];
  }

  type Thread extending default::Resource, Mixin::Embedded {
    overloaded required single link container: Aware {
      on target delete delete source;
    };
    comments := .<thread[is Comment];
    firstComment := (select .comments order by .createdAt asc limit 1);
    latestComment := (select .comments order by .createdAt desc limit 1);
  }

  type Comment extending default::Resource {
    required thread: Thread {
      on target delete delete source;
    };
    required body: default::RichText;
  }
}
