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
      (select Ethnologue::Language filter .language = __new__) ??
      (insert Ethnologue::Language {
        language := __new__,
        ownSensitivity := __new__.ownSensitivity,
        projectContext := __new__.projectContext
      })
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

    access policy CanSelectGeneratedFromAppPoliciesForLanguage
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ConsultantManager', 'ExperienceOperations', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Intern in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Mentor in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForLanguage
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForLanguage
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );
  }
  
  scalar type population extending int32 {
    constraint expression on (__subject__ >= 0);
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

    access policy CanSelectGeneratedFromAppPoliciesForEthnologueLanguage
    allow select using (
      (
        exists (<default::Role>{'Administrator', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} intersect (<default::User>(global default::currentUserId)).roles)
        or (
          default::Role.ConsultantManager in (<default::User>(global default::currentUserId)).roles
          and .sensitivity <= default::Sensitivity.Medium
        )
        or (
          exists (<default::Role>{'Consultant', 'ConsultantManager'} intersect (<default::User>(global default::currentUserId)).roles)
          and .isMember
        )
        or (
          default::Role.FieldPartner in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
        or (
          default::Role.Fundraising in (<default::User>(global default::currentUserId)).roles
          and (
            .isMember
            or .sensitivity <= default::Sensitivity.Medium
          )
        )
        or (
          exists (<default::Role>{'Marketing', 'Fundraising', 'ExperienceOperations'} intersect (<default::User>(global default::currentUserId)).roles)
          and .sensitivity <= default::Sensitivity.Low
        )
        or (
          default::Role.Translator in (<default::User>(global default::currentUserId)).roles
          and .isMember
        )
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForEthnologueLanguage
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForEthnologueLanguage
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );
  }
  
  scalar type code extending str {
    constraint regexp(r'^[a-z]{3}$');
  };
}
