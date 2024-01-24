CREATE MIGRATION m1zqlgbrht5kontkpocymsg2f7wit5rsxkmgy6uy56myfyhncrvlvq
    ONTO m1wdw2srbtq3ondtyuhcobwgcbdawourtp4vcapedti3kca2wh46dq
{
  ALTER TYPE default::Project EXTENDING Mixin::Postable BEFORE default::Resource;
  ALTER TYPE default::Language EXTENDING Mixin::Postable BEFORE default::Resource;
  ALTER TYPE default::Partner EXTENDING Mixin::Postable BEFORE default::Resource;
};
