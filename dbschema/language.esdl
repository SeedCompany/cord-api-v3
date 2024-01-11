module default {
  type Language extending Mixin::Postable, Resource, Project::ContextAware, Mixin::Named, Mixin::Pinnable, Mixin::Taggable {
    required displayName: str {
      default := .name;
    }
    displayNamePronunciation: str;
    
    overloaded required ownSensitivity: Sensitivity {
      annotation description := "The sensitivity of the language. This is a source / user settable.";
      default := Sensitivity.High;
    }
    
    trigger recalculateProjectSens after update for each do (
      update (
        select TranslationProject
        filter __new__ in .languages
          # Filter out projects without change, so modifiedAt isn't bumped
          and .ownSensitivity != max(.languages.ownSensitivity) ?? Sensitivity.High
      )
      set { ownSensitivity := max(.languages.ownSensitivity) ?? Sensitivity.High }
    );
    
    required single link ethnologue := assert_exists(assert_single(
      .<language[is Ethnologue::Language]
    ));
    trigger connectEthnologue after insert for each do (
      insert Ethnologue::Language {
        language := __new__,
        ownSensitivity := __new__.ownSensitivity,
        projectContext := __new__.projectContext
      }
    );
    trigger matchEthnologueToOwnSens after update for each do (
      update __new__.ethnologue
      filter .ownSensitivity != __new__.ownSensitivity
      set { ownSensitivity := __new__.ownSensitivity }
    );
    
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
    
    engagements := (
      # Similar to previous version but avoids https://github.com/edgedb/edgedb/issues/5846
      select LanguageEngagement filter __source__ = .language
    );
    projects := (
      select TranslationProject filter __source__ = .languages
    );
    overloaded link projectContext: Project::Context {
      default := (insert Project::Context);
    }
    
    index on ((.name, .ownSensitivity, .leastOfThese, .isSignLanguage, .isDialect));
  }
  
  scalar type population extending int32 {
    constraint min_value(0);
  }
}
 
module Ethnologue {
  type Language extending Project::ContextAware {
    required language: default::Language {
      on target delete delete source;
      constraint exclusive;
    };
    
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
