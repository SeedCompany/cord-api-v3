CREATE MIGRATION m1457xy4vwahulfxvplnwrlilb7k3q43344qns2kgbbrqu4eqqfeqq
    ONTO m1hekmmtve36s2nqc2qtj7w5ksjeylu7hdosxcd4ddvacgpm73h5cq
{
  ALTER TYPE Media::Dimensions {
      DROP PROPERTY height;
      DROP PROPERTY width;
  };
  ALTER TYPE Media::Visual {
      DROP LINK dimensions;
  };
  DROP TYPE Media::Dimensions;
  ALTER TYPE Media::Visual {
      CREATE REQUIRED PROPERTY dimensions: tuple<width: std::int16, height: std::int16> {
          SET REQUIRED USING (<tuple<width: std::int16, height: std::int16>>{});
      };
  };
};
