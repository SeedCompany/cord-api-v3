# API Schema

## User

checkEmailAddress(emailAddress): boolean
registerUser(emailAddress, password, browserToken): boolean
logoutUser(browserToken): boolean
loginUser(emailAddress, password)
getUserProfile(browserToken): User