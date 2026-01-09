CREATE MIGRATION m1ygkn7z2fbxc3d6ksyrseacehrboy4igjtjc3bdgfwmdsutbb4huq
    ONTO m13j2wdmzu2ee56a7cpvryzfqdoexqgfx2pbhqrdnrh5cjtkgybwhq
{
  ALTER TYPE Budget::Record {
      CREATE PROPERTY adjustedAmount: std::float32 {
          SET default := (.amount);
      };
      CREATE PROPERTY preApprovedAmount: std::float32;
  };
};
