CREATE MIGRATION m1qxegbs7vzamuvsv7cs6r4nntxkwayrdhdlkx3223iyq3hsidd3ga
    ONTO m1dppmmlph6slcbs3kbiwtpegecjb5isy335ff4zlglui4zghlkmua
{
  ALTER TYPE default::InternshipEngagement {
      DROP TRIGGER connectCertificationCeremony;
  };
  ALTER TYPE default::LanguageEngagement {
      DROP TRIGGER connectDedicationCeremony;
  };
};
