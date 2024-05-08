CREATE MIGRATION m1fbgjalpdly2ynslpxelakwlrebwydvioqw2m5gwu7edfijutsroa
    ONTO m1jmb5p3ypawyyn6yvctr5of2zp2mw5rd5iyzrxnqmn75eyp3viroq
{
  CREATE SCALAR TYPE Project::Type EXTENDING enum<MomentumTranslation, MultiplicationTranslation, Internship>;
  CREATE TYPE Project::FinancialApprover {
      CREATE REQUIRED LINK user: default::User {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED MULTI PROPERTY projectTypes: Project::Type;
  };
};
