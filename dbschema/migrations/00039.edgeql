CREATE MIGRATION m1mvx2kvem4tlq4bei5pmbcmnk23a4wqts3c23kpbo57xt5fplzcjq
    ONTO m1xftmn4ob3vc4ajtrn4kqtggwisgam2z6setwni7acbolvwicxt3q
{
  ALTER TYPE default::Project EXTENDING Mixin::Postable BEFORE default::Resource;
};
