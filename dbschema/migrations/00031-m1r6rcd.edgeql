CREATE MIGRATION m1r6rcdhmxmrrwod6cxod3pvet2ujlolrsqhkwlkwvs74ps437wdwa
    ONTO m1q4o6hxlasmvjestjii64p3kkzuvxon626xo4hykuwahicdrcxvta
{
  ALTER TYPE default::Project {
      CREATE PROPERTY rev79ProjectId: std::str;
  };
  ALTER TYPE default::LanguageEngagement {
      CREATE PROPERTY rev79CommunityId: std::str;
  };
};
