module Mixin {
  abstract type Audited extending Timestamped {
    required createdBy: default::Actor {
      readonly := true;
      default := global default::currentActor;
    };
    required modifiedBy: default::Actor {
      default := global default::currentActor;
      rewrite update using (global default::currentActor);
    };

    required isCreator := .createdBy ?= global default::currentActor;
  }

  abstract type Timestamped {
    required createdAt: datetime {
      default := datetime_of_statement();
      readonly := true;
    };
    required modifiedAt: datetime {
      default := datetime_of_statement(); # default here helps editor know it's not required.
      rewrite update using (datetime_of_statement());
    };
  }
}
