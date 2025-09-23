CREATE MIGRATION m1ginwudxmcbqqqn3ifjl3h77b3eeb63a6z6vd66ejwctn4dt23yta
    ONTO m1vlvhhn4bbuxj4ntl2zkrsjal3rhytpr5wqnxkfpaj7gyffawlfrq
{
  ALTER TYPE default::InternshipEngagement {
      CREATE PROPERTY gtlId: std::str;
      CREATE PROPERTY marketable: std::bool;
  };
};
