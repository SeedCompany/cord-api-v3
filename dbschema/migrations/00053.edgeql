CREATE MIGRATION m1vp4elagp7wzixttjl3s6pk2q5ml2p4zq35vvdc3nouewe3qvcm3q
    ONTO m1rqfvf4ah2ev4ncoxa6l7x5u6h6tssd6r7cbneshimgxzbtdzdppq
{
  CREATE TYPE Product::PartnershipProducingMedium EXTENDING Engagement::Child {
      CREATE REQUIRED LINK partnership: default::Partnership {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY medium: Product::Medium;
      CREATE CONSTRAINT std::exclusive ON ((.engagement, .partnership, .medium));
  };
};
