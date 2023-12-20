CREATE MIGRATION m1rob2znvgmu7myqon4wzkdxur6765udhhucohw6apoxhtrbbnxova
    ONTO m1aqhugpxmkst3yhkmyd5avjuqvbxk7ekgroiipkkhz3ockszv2rka
{
  CREATE ABSTRACT TYPE default::Producible EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE DELEGATED CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY scriptureReferences: multirange<std::int32>;
  };
  CREATE TYPE default::EthnoArt EXTENDING default::Producible;
  CREATE TYPE default::Film EXTENDING default::Producible;
  CREATE TYPE default::Story EXTENDING default::Producible;
};
