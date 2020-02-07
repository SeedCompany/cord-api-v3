export class IRequestUser {
  token: string;
  iat: number;
  owningOrgId: string | null;
  userId: string | null;
}