export class IRequestUser {
  token: string;
  iat: number;
  owningOrdId: string | null;
  userId: string | null;
}
