CREATE MIGRATION m1mpcychq5xznpqjnhf67qt7oasbo222voatcf23xm4wjaojlnzd2a
    ONTO m1whnqsnrcplwvgjlz57qcvkzld25fhydvj4xhihmfu6byois4ahda
{
  ALTER TYPE default::InternshipEngagement {
      CREATE PROPERTY webId: std::str;
  };
};
