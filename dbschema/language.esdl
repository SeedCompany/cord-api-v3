module default {
  type Language extending Resource, Pinnable, Taggable {
    required name: str;

    required displayName: str {
      default := .name;
    }
    displayNamePronunciation: str;

    required sensitivity: Sensitivity {
      annotation description := "The sensitivity of the language. This is a source / user settable.";
      default := Sensitivity.High;
    }

    required ethnologue: Ethnologue::Language {
      default := (insert Ethnologue::Language);
      on source delete delete target;
    }

    required isDialect: bool {
      default := false;
    }

    registryOfDialectsCode: str {
      constraint exclusive;
      constraint regexp(r'^[0-9]{5}$');
    }

    property population := .populationOverride ?? .ethnologue.population;
    populationOverride: population;

    required leastOfThese: bool {
      default := false;
    };
    leastOfTheseReason: str;

    required isSignLanguage: bool {
      default := false;
    };
    signLanguageCode: str {
      constraint regexp(r'^[A-Z]{2}\d{2}$');
    };

    sponsorEstimatedEndDate: cal::local_date;

    required hasExternalFirstScripture: bool {
      default := false;
    };
    optional firstScriptureEngagement: LanguageEngagement;
    # These two props above are mutually exclusive
    constraint expression on (
      (exists .firstScriptureEngagement and not .hasExternalFirstScripture)
      or not exists .firstScriptureEngagement
    );
  }

  scalar type population extending int32 {
    constraint min_value(0);
  }
}

module Ethnologue {
  type Language {
    code: code {
      constraint exclusive;
    };
    provisionalCode: code {
      constraint exclusive;
    };
    name: str;
    population: default::population;
  }

  scalar type code extending str {
    constraint regexp(r'^[a-z]{3}$');
  };
}
