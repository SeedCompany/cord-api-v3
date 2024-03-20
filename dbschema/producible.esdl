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

    access policy CanSelectGeneratedFromAppPoliciesForProducible
    allow select;

    access policy CanInsertGeneratedFromAppPoliciesForProducible
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProducible
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  }
  
  type EthnoArt extending Producible {
    access policy CanSelectGeneratedFromAppPoliciesForEthnoArt
    allow select;

    access policy CanInsertGeneratedFromAppPoliciesForEthnoArt
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForEthnoArt
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  };
  type Film extending Producible {
    access policy CanSelectGeneratedFromAppPoliciesForFilm
    allow select;

    access policy CanInsertGeneratedFromAppPoliciesForFilm
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForFilm
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  };
  type Story extending Producible {
    access policy CanSelectGeneratedFromAppPoliciesForStory
    allow select;

    access policy CanInsertGeneratedFromAppPoliciesForStory
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect givenRoles)
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForStory
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );
  };
}
