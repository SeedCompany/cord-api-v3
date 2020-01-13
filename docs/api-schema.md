# API Schema

## User

session(browserToken?: string): Session
isEmailAvailable(emailAddress: string): boolean
registerUser(emailAddress: string, password: string, browserToken: string): boolean
logout(browserToken: string): boolean
login(emailAddress: string, password: string)
getUser(id: string): User

## Project

## Intership

## Langauges

same as org

## Organization

createOrganization(name: string): Organization
updateOrganization(org: Partial<Organization>): Organization
deleteOrganization(id: string): boolean
organizations(filter?: string, page?: number = 0, count?: number = 10, order?: string = "asc", sort?: string): List<Organization>
organization(id?: string, name?: string): Organization?


qualified
red flags
distinquishing
