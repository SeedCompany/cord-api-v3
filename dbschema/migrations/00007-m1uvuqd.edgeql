CREATE MIGRATION m1uvuqdzrjlvsf6g6caqgswsczfl2ior55flcx3j6klxacgfgclyqa
    ONTO m17ecruskq3k5hphihs23fnzzaf7fjd2obhafu3mvgbefnsn2an5iq
{
  ALTER TYPE default::Engagement EXTENDING Comments::Aware LAST;
  ALTER TYPE default::User EXTENDING Comments::Aware BEFORE default::Resource;
  ALTER TYPE default::ProgressReport EXTENDING Comments::Aware LAST;
  ALTER TYPE default::Language EXTENDING Comments::Aware BEFORE default::Resource;
  ALTER TYPE default::Partner EXTENDING Comments::Aware BEFORE default::Resource;
};
