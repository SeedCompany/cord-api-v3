CREATE MIGRATION m1rqfvf4ah2ev4ncoxa6l7x5u6h6tssd6r7cbneshimgxzbtdzdppq
    ONTO m1tgd6yl63z2bp7ahtbi7sidb5gfl7mjs47ooqfbnuleffpap3auua
{
  CREATE FUNCTION default::hydrate(typeName: std::str, scopedValue: std::json) ->  std::str USING (typeName);
};
