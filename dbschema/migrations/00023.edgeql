CREATE MIGRATION m1fwq4yhnz7uisuchd4tgim3dsgmvo725eif7qfi7pwx3cxegq4cfq
    ONTO m1kwmpnrei2jr2g5jm6cglifrryeelf6oo4p6v7on4qslj2dsd7cja
{
  ALTER TYPE Mixin::Named {
      CREATE INDEX fts::index ON (fts::with_options(.name, language := fts::Language.eng));
  };
};
