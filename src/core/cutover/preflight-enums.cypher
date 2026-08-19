// ═══════════════════════════════════════════════════════════════════════════════
// CUTOVER PRE-FLIGHT — stored enum values against the Postgres enum that receives them
//
// READ-ONLY. Every leg returns exactly ONE row even when it matches nothing, so a
// clean property and a broken pattern are never confused.
//
// Read the columns as:
//   distinctValues  distinct live values seen. ZERO means the pattern matched
//                   nothing — a BROKEN LEG, not a clean result. Check it.
//   wouldDrop       values the Postgres enum does not declare. MUST be empty.
//
// Why this exists rather than a value dump: the answer has to be computed against
// the enum, and reading a dump by eye (or through a parser) is where the mistakes
// happen. The allowed lists below are generated FROM the schema, so they cannot
// drift from it by hand-editing.
//
// TWO different failures hide here, and they look nothing alike:
//   · A value dropped by sanitizeEnum — the ROW STILL LANDS, minus that value.
//     Invisible to row-count reconciliation. This is what wouldDrop predicts.
//   · A value on a column whose extractor does NOT sanitise — the CAST FAILS and
//     the whole load stops. Louder, but the same root cause.
//
// Storage shape matters and is stated per leg: a sweep that only walks Property
// nodes silently misses every enum held on the node itself or on a relationship.
// That mistake was made once; hence the 'storedAs' column.
// ═══════════════════════════════════════════════════════════════════════════════

// Rows are ORDERED so anything needing attention is at the TOP:
//   · a non-empty `wouldDrop` first  — a value the Postgres enum rejects
//   · then any `distinctValues = 0`  — a leg that matched nothing, i.e. very
//     likely a WRONG leg rather than an empty domain. One was found that way
//     (media category, which is stored on the node, not as a Property node).
// A fully clean run therefore starts with a row whose wouldDrop is [] and whose
// distinctValues is > 0.

CALL {
  MATCH (n:Budget)-[r:status { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Budget.status' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Pending', 'Current', 'Superceded', 'Rejected']] AS wouldDrop
  UNION ALL
  MATCH (n:Ceremony)-[r:type { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Ceremony.type' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Dedication', 'Certification']] AS wouldDrop
  UNION ALL
  MATCH (n:Engagement)-[r:status { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Engagement.status' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['InDevelopment', 'DidNotDevelop', 'Rejected', 'Active', 'ActiveChangedPlan', 'DiscussingTermination', 'DiscussingReactivation', 'DiscussingChangeToPlan', 'DiscussingSuspension', 'Suspended', 'FinalizingCompletion', 'Terminated', 'Completed', 'Converted', 'Unapproved', 'Transferred', 'NotRenewed']] AS wouldDrop
  UNION ALL
  // Superseded statuses feed engagement_status_history and are a SEPARATE value
  // domain from the live one above -- a status retired years ago survives only
  // here. No label filter on p, and active:false, exactly matching what the
  // engagement extractor reads (a superseded property node is Deleted_Property).
  MATCH (n:Engagement)-[r:status { active: false }]->(p)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Engagement.status (superseded/history)' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['InDevelopment', 'DidNotDevelop', 'Rejected', 'Active', 'ActiveChangedPlan', 'DiscussingTermination', 'DiscussingReactivation', 'DiscussingChangeToPlan', 'DiscussingSuspension', 'Suspended', 'FinalizingCompletion', 'Terminated', 'Completed', 'Converted', 'Unapproved', 'Transferred', 'NotRenewed']] AS wouldDrop
  UNION ALL
  MATCH (n:Engagement)-[r:methodologies { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Engagement.methodologies' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Paratext', 'OtherWritten', 'Render', 'Audacity', 'AdobeAudition', 'OtherOralTranslation', 'StoryTogether', 'SeedCompanyMethod', 'OneStory', 'Craft2Tell', 'OtherOralStories', 'Film', 'SignLanguage', 'OtherVisual']] AS wouldDrop
  UNION ALL
  MATCH (n:Engagement)-[r:milestonePlanned { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Engagement.milestonePlanned' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Unknown', 'None', 'OldTestament', 'NewTestament', 'FullBible']] AS wouldDrop
  UNION ALL
  MATCH (n:Location)-[r:type { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Location.type' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Country', 'City', 'County', 'Region', 'State', 'CrossBorderArea']] AS wouldDrop
  UNION ALL
  MATCH (n:Organization)-[r:types { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Organization.types' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Church', 'Parachurch', 'Mission', 'Translation', 'Alliance']] AS wouldDrop
  UNION ALL
  MATCH (n:Organization)-[r:reach { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Organization.reach' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Local', 'Regional', 'National', 'Global']] AS wouldDrop
  UNION ALL
  MATCH (n:Partner)-[r:types { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Partner.types' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Managing', 'Funding', 'Impact', 'Technical', 'Resource']] AS wouldDrop
  UNION ALL
  MATCH (n:Partner)-[r:financialReportingTypes { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Partner.financialReportingTypes' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Funded', 'FieldEngaged', 'Hybrid']] AS wouldDrop
  UNION ALL
  MATCH (n:Partner)-[r:approvedPrograms { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Partner.approvedPrograms' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['MomentumTranslation', 'MultiplicationTranslation', 'Internship']] AS wouldDrop
  UNION ALL
  MATCH (n:Partnership)-[r:types { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Partnership.types' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Managing', 'Funding', 'Impact', 'Technical', 'Resource']] AS wouldDrop
  UNION ALL
  MATCH (n:Partnership)-[r:agreementStatus { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Partnership.agreementStatus' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['NotAttached', 'AwaitingSignature', 'Signed']] AS wouldDrop
  UNION ALL
  MATCH (n:Partnership)-[r:mouStatus { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Partnership.mouStatus' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['NotAttached', 'AwaitingSignature', 'Signed']] AS wouldDrop
  UNION ALL
  MATCH (n:PeriodicReport)-[r:status { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'PeriodicReport.status' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['NotStarted', 'InProgress', 'PendingTranslation', 'InReview', 'Approved', 'Published']] AS wouldDrop
  UNION ALL
  MATCH (n:PeriodicReport)-[r:type { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'PeriodicReport.type' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Financial', 'Narrative', 'Progress']] AS wouldDrop
  UNION ALL
  MATCH (n:Post)-[r:type { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Post.type' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Note', 'Story', 'Prayer']] AS wouldDrop
  UNION ALL
  MATCH (n:Post)-[r:shareability { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Post.shareability' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Membership', 'ProjectTeam', 'Internal', 'AskToShareExternally', 'External']] AS wouldDrop
  UNION ALL
  MATCH (n:Producible)-[r:mediums { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Producible.mediums' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Print', 'Web', 'EBook', 'App', 'TrainedStoryTellers', 'Audio', 'Video', 'Other']] AS wouldDrop
  UNION ALL
  MATCH (n:Producible)-[r:purposes { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Producible.purposes' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['EvangelismChurchPlanting', 'ChurchLife', 'ChurchMaturity', 'SocialIssues', 'Discipleship']] AS wouldDrop
  UNION ALL
  MATCH (n:Producible)-[r:steps { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Producible.steps' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['ExegesisAndFirstDraft', 'TeamCheck', 'CommunityTesting', 'BackTranslation', 'ConsultantCheck', 'InternalizationAndDrafting', 'PeerRevision', 'ConsistencyCheckAndFinalEdits', 'Craft', 'Test', 'Check', 'Record', 'Develop', 'Translate', 'Completed']] AS wouldDrop
  UNION ALL
  MATCH (n:Product)-[r:mediums { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Product.mediums' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Print', 'Web', 'EBook', 'App', 'TrainedStoryTellers', 'Audio', 'Video', 'Other']] AS wouldDrop
  UNION ALL
  MATCH (n:Product)-[r:purposes { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Product.purposes' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['EvangelismChurchPlanting', 'ChurchLife', 'ChurchMaturity', 'SocialIssues', 'Discipleship']] AS wouldDrop
  UNION ALL
  MATCH (n:Product)-[r:steps { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Product.steps' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['ExegesisAndFirstDraft', 'TeamCheck', 'CommunityTesting', 'BackTranslation', 'ConsultantCheck', 'InternalizationAndDrafting', 'PeerRevision', 'ConsistencyCheckAndFinalEdits', 'Craft', 'Test', 'Check', 'Record', 'Develop', 'Translate', 'Completed']] AS wouldDrop
  UNION ALL
  MATCH (n:Project)-[r:status { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Project.status' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['InDevelopment', 'Active', 'Terminated', 'Completed', 'DidNotDevelop']] AS wouldDrop
  UNION ALL
  MATCH (n:Project)-[r:step { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Project.step' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['EarlyConversations', 'PendingConceptApproval', 'PrepForConsultantEndorsement', 'PendingConsultantEndorsement', 'PrepForFinancialEndorsement', 'PendingFinancialEndorsement', 'FinalizingProposal', 'PendingRegionalDirectorApproval', 'PendingZoneDirectorApproval', 'PendingFinanceConfirmation', 'OnHoldFinanceConfirmation', 'DidNotDevelop', 'Rejected', 'Active', 'ActiveChangedPlan', 'DiscussingChangeToPlan', 'PendingChangeToPlanApproval', 'PendingChangeToPlanConfirmation', 'DiscussingSuspension', 'PendingSuspensionApproval', 'Suspended', 'DiscussingReactivation', 'PendingReactivationApproval', 'DiscussingTermination', 'PendingTerminationApproval', 'FinalizingCompletion', 'Terminated', 'Completed']] AS wouldDrop
  UNION ALL
  MATCH (n:Project)-[r:sensitivity { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Project.sensitivity' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Low', 'Medium', 'High']] AS wouldDrop
  UNION ALL
  MATCH (n:Language)-[r:sensitivity { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Language.sensitivity' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Low', 'Medium', 'High']] AS wouldDrop
  UNION ALL
  MATCH (n:ProjectMember)-[r:roles { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'ProjectMember.roles' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Administrator', 'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FieldServices', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Leadership', 'Liaison', 'Marketing', 'Mentor', 'MultiplicationFinanceApprover', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator']] AS wouldDrop
  UNION ALL
  MATCH (n:User)-[r:roles { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'User.roles' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Administrator', 'BetaTester', 'BibleTranslationLiaison', 'Consultant', 'ConsultantManager', 'Controller', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FieldServices', 'FinancialAnalyst', 'Fundraising', 'Intern', 'LeadFinancialAnalyst', 'Leadership', 'Liaison', 'Marketing', 'Mentor', 'MultiplicationFinanceApprover', 'ProjectManager', 'RegionalCommunicationsCoordinator', 'RegionalDirector', 'StaffMember', 'Translator']] AS wouldDrop
  UNION ALL
  MATCH (n:User)-[r:status { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'User.status' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Active', 'Disabled']] AS wouldDrop
  UNION ALL
  MATCH (n:User)-[r:gender { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'User.gender' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Male', 'Female']] AS wouldDrop
  UNION ALL
  MATCH (n:Education)-[r:degree { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Education.degree' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Primary', 'Secondary', 'Associates', 'Bachelors', 'Masters', 'Doctorate']] AS wouldDrop
  UNION ALL
  MATCH (n:Tool)-[r:key { active: true }]->(p:Property)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND p.value IS NOT NULL
  UNWIND (CASE WHEN p.value IS :: LIST<ANY> THEN p.value ELSE [p.value] END) AS v
  WITH collect(DISTINCT toString(v)) AS vals
  RETURN 'Tool.key' AS property, 'Property node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Rev79']] AS wouldDrop
  UNION ALL
  MATCH (n:ProgressSummary)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND n.period IS NOT NULL
  WITH collect(DISTINCT toString(n.period)) AS vals
  RETURN 'ProgressSummary.period' AS property, 'on the node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['ReportPeriod', 'FiscalYearSoFar', 'Cumulative']] AS wouldDrop
  UNION ALL
  MATCH (n:StepProgress)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND n.step IS NOT NULL
  WITH collect(DISTINCT toString(n.step)) AS vals
  RETURN 'StepProgress.step' AS property, 'on the node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['ExegesisAndFirstDraft', 'TeamCheck', 'CommunityTesting', 'BackTranslation', 'ConsultantCheck', 'InternalizationAndDrafting', 'PeerRevision', 'ConsistencyCheckAndFinalEdits', 'Craft', 'Test', 'Check', 'Record', 'Develop', 'Translate', 'Completed']] AS wouldDrop
  UNION ALL
  MATCH (n:ProgressReportWorkflowEvent)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND n.status IS NOT NULL
  WITH collect(DISTINCT toString(n.status)) AS vals
  RETURN 'ProgressReportWorkflowEvent.status' AS property, 'on the node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['NotStarted', 'InProgress', 'PendingTranslation', 'InReview', 'Approved', 'Published']] AS wouldDrop
  UNION ALL
  MATCH (n:ProgressReportMedia)
  WHERE NOT any(l IN labels(n) WHERE l STARTS WITH 'Deleted_') AND n.category IS NOT NULL
  WITH collect(DISTINCT toString(n.category)) AS vals
  RETURN 'ProgressReportMedia.category' AS property, 'on the node' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Team', 'WorkInProgress', 'CommunityEngagement', 'LifeInCommunity', 'Events', 'SceneryLandscape', 'Other']] AS wouldDrop
  UNION ALL
  MATCH (:User)-[r:knownLanguage { active: true }]->(:Language)
  WHERE r.value IS NOT NULL
  WITH collect(DISTINCT toString(r.value)) AS vals
  RETURN 'KnownLanguage.proficiency' AS property, 'on the edge' AS storedAs, size(vals) AS distinctValues,
         [x IN vals WHERE NOT x IN ['Beginner', 'Conversational', 'Skilled', 'Fluent']] AS wouldDrop
}
WITH property, storedAs, distinctValues, wouldDrop
RETURN property, storedAs, distinctValues, wouldDrop
  ORDER BY size(wouldDrop) DESC, distinctValues ASC, property
