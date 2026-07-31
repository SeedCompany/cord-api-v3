// ═══════════════════════════════════════════════════════════════════════════════
// CUTOVER PRE-FLIGHT — duplicate live values on every Postgres unique index
//
// READ-ONLY. Every leg returns exactly one row even when it matches nothing, so a
// clean constraint and a broken pattern are never confused (the aggregation
// collapses to a single row BEFORE the leg's label literal is attached).
//
// Read the columns as:
//   scannedKeys    distinct live key values seen. ZERO here means the pattern
//                  matched nothing — treat as a BROKEN LEG, not a clean result.
//   dupGroups      key values held by more than one live row.
//   rowsWouldDrop  rows the loader silently sheds to onConflictDoNothing.
//
// rowsWouldDrop is NOT a row count — for a root entity it is a SUBTREE count.
// Measured example: 19 dropped languages cost ~1,400 rows downstream.
// ═══════════════════════════════════════════════════════════════════════════════

// ── TIER 1 — root entities: a drop here takes its whole subtree ───────────────

MATCH (n:Project)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'projects.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:Project)-[:departmentId {active:true}]->(p:Property) WHERE p.value IS NOT NULL
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'projects.departmentId (non-null)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:Location)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'locations.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:Location)-[:isoAlpha3 {active:true}]->(p:Property) WHERE p.value IS NOT NULL
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'locations.isoAlpha3 (non-null) <-- the real cause of the dev 9-row drop' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:Organization)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'organizations.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:FieldZone)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'field_zones.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:FieldRegion)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'field_regions.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:FundingAccount)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'funding_accounts.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:EthnologueLanguage)-[:code {active:true}]->(p:Property) WHERE p.value IS NOT NULL
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'ethnologue.code (non-null)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:EthnologueLanguage)-[:provisionalCode {active:true}]->(p:Property) WHERE p.value IS NOT NULL
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'ethnologue.provisionalCode (non-null)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (org:Organization)<-[:organization {active:true}]-(n:Partner)
WITH org.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'partners.organization (one partner per org)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n)-[:name {active:true}]->(p:Property) WHERE n:Film OR n:Story OR n:EthnoArt
// NOT labels(n)[0] — that is 'BaseNode' for every producible, which would fold
// a Film and a Story sharing a name into one group and report a FALSE dup.
WITH (CASE WHEN n:Film THEN 'Film' WHEN n:Story THEN 'Story' ELSE 'EthnoArt' END)
     + '/' + p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'producibles.(type,name)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (proj:Project)-[:engagement {active:true}]->(n:LanguageEngagement)-[:language {active:true}]->(l:Language)
WITH proj.id + '/' + l.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'engagements.(project,language)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (proj:Project)-[:engagement {active:true}]->(n:InternshipEngagement)-[:intern {active:true}]->(u:User)
WITH proj.id + '/' + u.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'engagements.(project,intern)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop

// ── TIER 2 — junctions and children: a drop here loses one row ───────────────

UNION ALL
MATCH (proj:Project)-[:member {active:true}]->(n:ProjectMember)-[:user {active:true}]->(u:User)
WITH proj.id + '/' + u.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'project_members.(project,user)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (proj:Project)-[:partnership {active:true}]->(n:Partnership)-[:partner {active:true}]->(pa:Partner)
WITH proj.id + '/' + pa.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'partnerships.(project,partner)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (proj:Project)-[:partnership {active:true}]->(n:Partnership)-[:primary {active:true}]->(p:Property {value:true})
WITH proj.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'partnerships one PRIMARY per project' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (u:User)-[:primaryOrganization {active:true}]->(o:Organization)
WITH u.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'user_organizations one PRIMARY per user' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (e:Engagement)-[:ceremony {active:true}]->(n:Ceremony)
WITH e.id AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'ceremonies one per engagement' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (b:Budget)-[:record {active:true}]->(n:BudgetRecord)-[:organization {active:true}]->(o:Organization)
MATCH (n)-[:fiscalYear {active:true}]->(fy:Property)
WITH b.id + '/' + o.id + '/' + toString(fy.value) AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'budget_records.(budget,org,fy)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:Tool)-[:name {active:true}]->(p:Property)
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'tools.name' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop
UNION ALL
MATCH (n:Tool)-[:key {active:true}]->(p:Property) WHERE p.value IS NOT NULL
WITH p.value AS v, count(*) AS c
WITH count(*) AS k, sum(CASE WHEN c>1 THEN 1 ELSE 0 END) AS g, sum(CASE WHEN c>1 THEN c-1 ELSE 0 END) AS d
RETURN 'tools.key (non-null)' AS check, k AS scannedKeys, g AS dupGroups, d AS rowsWouldDrop;
