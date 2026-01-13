CREATE MIGRATION m12ts3fog5hksrsvnr3ddcei5ibyyotspv2xw2ixleuqtraondodea
    ONTO m13j2wdmzu2ee56a7cpvryzfqdoexqgfx2pbhqrdnrh5cjtkgybwhq
{
  ALTER TYPE Budget::Record {
      CREATE PROPERTY initialAmount: std::float32;
      CREATE PROPERTY preApprovedAmount: std::float32;
  };
};
