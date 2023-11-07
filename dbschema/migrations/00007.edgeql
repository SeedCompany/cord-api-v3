CREATE MIGRATION m17wcugznjhc34awd734qo7mxst3vzwhc54xjrqawsjtlcuhbafdga
    ONTO m1hjnudahjdbrqvoi7ikqsalk5uv4gyfk5rbzcnonq2qoauw4ee2ea
{
  ALTER TYPE Project::Resource {
      DROP PROPERTY sensitivity;
  };
  ALTER TYPE default::Language {
      DROP INDEX ON (.sensitivity);
      DROP PROPERTY effectiveSensitivity;
  };
};
