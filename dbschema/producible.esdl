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

    access policy CanSelectUpdateReadUpdateWriteGeneratedFromAppPoliciesForProducible
    allow select, update read, update write;

    access policy CanInsertGeneratedFromAppPoliciesForProducible
    allow insert using (
      exists (<Role>{'Administrator', 'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} intersect global currentRoles)
    );

    access policy CanDeleteGeneratedFromAppPoliciesForProducible
    allow delete using (
      Role.Administrator in global currentRoles
    );
  }
  
  type EthnoArt extending Producible;
  type Film extending Producible;
  type Story extending Producible;
}
