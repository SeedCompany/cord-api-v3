module default {
  abstract type Producible extending Resource, Mixin::Named {
    overloaded name {
      delegated constraint exclusive;
    };
    
    scripture: Scripture::Collection {
      on source delete delete target;
      # https://github.com/edgedb/edgedb/issues/5827
      # rewrite insert, update using (
      #   if exists .scripture.verses then .scripture else <Scripture::Collection>{}
      # );
    }
    # Enforce no empty collections for this type's use-case. Use null/empty-set instead.
    trigger denyEmptyScriptureCollection after insert, update for each do (
      assert(
        not exists __new__.scripture or exists __new__.scripture.verses,
        message := "`Producible.scripture` should have a `Scripture::Collection` with verses or be null/empty-set"
      )
    );
    
    trigger updateDerivativeProducts after update for each
      when (__old__.scripture ?!= __new__.scripture)
      do (
        update DerivativeScriptureProduct
        filter .produces = __new__ and not exists .scriptureOverride
        set { scripture := __new__.scripture }
      );

    access policy CanReadGeneratedFromAppPoliciesForProducible
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForProducible
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForProducible
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  }
  
  type EthnoArt extending Producible {
    access policy CanReadGeneratedFromAppPoliciesForEthnoArt
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForEthnoArt
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForEthnoArt
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  };
  type Film extending Producible {
    access policy CanReadGeneratedFromAppPoliciesForFilm
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForFilm
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForFilm
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  };
  type Story extending Producible {
    access policy CanReadGeneratedFromAppPoliciesForStory
    allow select using (
      not exists default::currentUser
    );
    access policy CanCreateGeneratedFromAppPoliciesForStory
    allow insert using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect default::currentUser.roles)
    );
    access policy CanDeleteGeneratedFromAppPoliciesForStory
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
  };
}
