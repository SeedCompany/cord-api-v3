module default {
  type Language extending Resource, Mixin::Pinnable, Mixin::Taggable {
    required name: str;
    index on (str_sortable(.name));
    
    required displayName: str {
      default := .name;
    }
    displayNamePronunciation: str;
    
    required sensitivity: Sensitivity {
      annotation description := "The sensitivity of the language. This is a source / user settable.";
      default := Sensitivity.High;
    }
    index on (.sensitivity);
    
    property effectiveSensitivity := max(.projects.sensitivity) ?? .sensitivity;
    trigger recalculateProjectSens after update for each do (
      update (
        select __new__.projects
        # Filter out projects without change, so modifiedAt isn't bumped
        filter .sensitivity != max(.languages.sensitivity) ?? Sensitivity.High
      )
      set { sensitivity := max(.languages.sensitivity) ?? Sensitivity.High }
    );
    
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
    
    multi link engagements := (
      # Similar to previous version but avoids https://github.com/edgedb/edgedb/issues/5846
      select LanguageEngagement filter __source__ = .language
    );
    multi link projects := .engagements.project;
    
    property isMember := exists .projects.isMember;
    
    index on ((.name, .sensitivity, .leastOfThese, .isSignLanguage, .isDialect));
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
