MATCH (reqUser:User { active: true, id: 'ac3K0mtn2' })
MATCH (baseNode:BaseNode { active: true, id: 'ac3K0mtn2' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'realFirstName', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[realFirstName_rel:realFirstName { active: true }]->(realFirstName:Property { active: true })
SET realFirstName_rel = { active: false }, realFirstName = { active: false }
CREATE (baseNode)-[:realFirstName { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(realFirstName_new:Property { active: true, value: 'michael', createdAt: '2020-05-22T19:08:01.289-05:00' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'realLastName', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[realLastName_rel:realLastName { active: true }]->(realLastName:Property { active: true })
SET realLastName_rel = { active: false }, realLastName = { active: false }
CREATE (baseNode)-[:realLastName { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(realLastName_new:Property { active: true, value: 'marshall', createdAt: '2020-05-22T19:08:01.289-05:00' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'displayFirstName', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[displayFirstName_rel:displayFirstName { active: true }]->(displayFirstName:Property { active: true })
SET displayFirstName_rel = { active: false }, displayFirstName = { active: false }
CREATE (baseNode)-[:displayFirstName { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(displayFirstName_new:Property { active: true, value: 'asdf', createdAt: '2020-05-22T19:08:01.289-05:00' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'displayLastName', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[displayLastName_rel:displayLastName { active: true }]->(displayLastName:Property { active: true })
SET displayLastName_rel = { active: false }, displayLastName = { active: false }
CREATE (baseNode)-[:displayLastName { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(displayLastName_new:Property { active: true, value: 'asdf', createdAt: '2020-05-22T19:08:01.289-05:00' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'phone', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[phone_rel:phone { active: true }]->(phone:Property { active: true })
SET phone_rel = { active: false }, phone = { active: false }
CREATE (baseNode)-[:phone { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(phone_new:Property { active: true, value: 'asdf', createdAt: '2020-05-22T19:08:01.289-05:00' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'timezone', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[timezone_rel:timezone { active: true }]->(timezone:Property { active: true })
SET timezone_rel = { active: false }, timezone = { active: false }
CREATE (baseNode)-[:timezone { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(timezone_new:Property { active: true, value: 'asdf', createdAt: '2020-05-22T19:08:01.289-05:00' })
WITH *
MATCH (reqUser)<-[:member { active: true }]-(:SecurityGroup { active: true })-[:permission { active: true }]->(:Permission { property: 'bio', edit: true, active: true })-[:baseNode { active: true }]->(baseNode)
OPTIONAL MATCH (baseNode)-[bio_rel:bio { active: true }]->(bio:Property { active: true })
SET bio_rel = { active: false }, bio = { active: false }
CREATE (baseNode)-[:bio { active: true, createdAt: '2020-05-22T19:08:01.289-05:00' }]->(bio_new:Property { active: true, value: 'asdf', createdAt: '2020-05-22T19:08:01.289-05:00' })
RETURN baseNode.id AS id;
