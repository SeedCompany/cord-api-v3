CREATE MIGRATION m1ku55m2qkjmqjhurge3iiolac7zkf76zuzrs2y7u7djghui4fhima
    ONTO m15hyucs7xuol37hmbk5kyuquxwa6a7wrmj722fka3w2pifsfdywsq
{
  ALTER TYPE default::Project {
      DROP PROPERTY presetInventory;
  };
};
