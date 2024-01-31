module default {
  abstract type Producible extending Resource, Mixin::Named {
    overloaded name {
      delegated constraint exclusive;
    };
    
    scripture: Scripture::Collection {
      on source delete delete target if orphan;
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
  }
  
  type EthnoArt extending Producible;
  type Film extending Producible;
  type Story extending Producible;
}
