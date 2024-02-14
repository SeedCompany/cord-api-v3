module default {
  type Alias {
    required name: str {
      constraint exclusive;
    };
    required target: Object {
      on target delete delete source;
    };
  }
}
