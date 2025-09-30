CREATE MIGRATION m1fxga4bkizfi427as2vhb33qnoe3tmkgrgsjduut7nksdhcv5llqa
    ONTO m1vlvhhn4bbuxj4ntl2zkrsjal3rhytpr5wqnxkfpaj7gyffawlfrq
{
  ALTER TYPE default::InternshipEngagement {
      CREATE REQUIRED PROPERTY marketable: std::bool {
          SET default := false;
      };
  };
};
