CREATE MIGRATION m1rtq3fw45vdkon7lgrpisvdak2g663tcv7bekfed2bfxgkj23lu4q
    ONTO m17wcugznjhc34awd734qo7mxst3vzwhc54xjrqawsjtlcuhbafdga
{
  ALTER TYPE default::Language {
      ALTER PROPERTY sensitivity {
          RENAME TO ownSensitivity;
      };
  };
};
