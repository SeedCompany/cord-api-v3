CREATE MIGRATION m1kgkikeo6qaen7zzrnuhvhfiqak32ap254imd6or7naaatelnf24q
    ONTO m1rtq3fw45vdkon7lgrpisvdak2g663tcv7bekfed2bfxgkj23lu4q
{
  ALTER TYPE default::Project {
      ALTER PROPERTY sensitivity {
          RENAME TO ownSensitivity;
      };
  };
};
