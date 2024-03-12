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
    
    trigger updateDerivativeProducts after update for each do (
      update DerivativeScriptureProduct
      filter DerivativeScriptureProduct.produces = __new__
        and __new__.scripture != __old__.scripture
        and not exists .scriptureOverride
      set { scripture := __new__.scripture }
    );
  }
  
  type EthnoArt extending Producible;
  type Film extending Producible;
  type Story extending Producible;
}
