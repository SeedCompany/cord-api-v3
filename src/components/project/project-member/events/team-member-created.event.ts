// a team member was created and added to a project
export class TeamMemberCreatedEvent {
  constructor(readonly projectId: string, readonly userId: string) {}
}
