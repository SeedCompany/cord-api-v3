MATCH (reqUser:User { id: '4bLGxElGS' }), (baseNode:BaseNode { id: '4bLGxElGS' }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(email_permission:Permission { property: 'email', read: true, active: true })-[:baseNode]->(baseNode)-[:email]->(email_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(realFirstName_permission:Permission { property: 'realFirstName', read: true, active: true })-[:baseNode]->(baseNode)-[:realFirstName]->(realFirstName_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(realLastName_permission:Permission { property: 'realLastName', read: true, active: true })-[:baseNode]->(baseNode)-[:realLastName]->(realLastName_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(displayFirstName_permission:Permission { property: 'displayFirstName', read: true, active: true })-[:baseNode]->(baseNode)-[:displayFirstName]->(displayFirstName_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(displayLastName_permission:Permission { property: 'displayLastName', read: true, active: true })-[:baseNode]->(baseNode)-[:displayLastName]->(displayLastName_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(phone_permission:Permission { property: 'phone', read: true, active: true })-[:baseNode]->(baseNode)-[:phone]->(phone_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(timezone_permission:Permission { property: 'timezone', read: true, active: true })-[:baseNode]->(baseNode)-[:timezone]->(timezone_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(bio_permission:Permission { property: 'bio', read: true, active: true })-[:baseNode]->(baseNode)-[:bio]->(bio_var:Property { active: true }), (reqUser)<-[:member { active: true }]-(sg:SecurityGroup { active: true })-[:permission { active: true }]->(password_permission:Permission { property: 'password', read: true, active: true })-[:baseNode]->(baseNode)-[:password]->(password_var:Property { active: true })
RETURN email_var.value AS email, email_permission.read AS emailRead, email_permission.edit AS emailEdit, email_permission.admin AS emailAdmin, realFirstName_var.value AS realFirstName, realFirstName_permission.read AS realFirstNameRead, realFirstName_permission.edit AS realFirstNameEdit, realFirstName_permission.admin AS realFirstNameAdmin, realLastName_var.value AS realLastName, realLastName_permission.read AS realLastNameRead, realLastName_permission.edit AS realLastNameEdit, realLastName_permission.admin AS realLastNameAdmin, displayFirstName_var.value AS displayFirstName, displayFirstName_permission.read AS displayFirstNameRead, displayFirstName_permission.edit AS displayFirstNameEdit, displayFirstName_permission.admin AS displayFirstNameAdmin, displayLastName_var.value AS displayLastName, displayLastName_permission.read AS displayLastNameRead, displayLastName_permission.edit AS displayLastNameEdit, displayLastName_permission.admin AS displayLastNameAdmin, phone_var.value AS phone, phone_permission.read AS phoneRead, phone_permission.edit AS phoneEdit, phone_permission.admin AS phoneAdmin, timezone_var.value AS timezone, timezone_permission.read AS timezoneRead, timezone_permission.edit AS timezoneEdit, timezone_permission.admin AS timezoneAdmin, bio_var.value AS bio, bio_permission.read AS bioRead, bio_permission.edit AS bioEdit, bio_permission.admin AS bioAdmin, password_var.value AS password, password_permission.read AS passwordRead, password_permission.edit AS passwordEdit, password_permission.admin AS passwordAdmin;