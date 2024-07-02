CREATE MIGRATION m1bzq66kx6aa3adornnuhmqpmmqmj6z6i2qt6higxnkz7kw3fspcbq
    ONTO m1gq2hsptfudyqzcqhaz3o5ikdckynzcdegdixqtrdtnisldpyqv6a
{
  ALTER TYPE default::InternshipEngagement {
      CREATE MULTI PROPERTY methodologies: Product::Methodology;
  };
  CREATE SCALAR TYPE Engagement::InternPosition EXTENDING enum<ConsultantInTraining, MidLevelQualityAssurance, LeadershipDevelopment, Mobilization, Personnel, Communication, Administration, Technology, Finance, LanguageProgramManager, Literacy, OralityFacilitator, ScriptureEngagement, OtherAttached, OtherTranslationCapacity, OtherPartnershipCapacity, ExegeticalFacilitator, TranslationFacilitator>;
  ALTER TYPE default::InternshipEngagement {
      CREATE PROPERTY position: Engagement::InternPosition;
  };
};
