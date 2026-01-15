CREATE MIGRATION m1stuiewjnhrznhwslwjqll7jd3rattughkehe3krd4oegtezhclka
    ONTO m1k2xtayazrywfs6y4bvw24x5id4xgsdjiu5uuk525becui22bcnya
{
  ALTER TYPE Budget::Record {
      CREATE PROPERTY initialAmount: std::float32;
      CREATE PROPERTY preApprovedAmount: std::float32;
  };
};
