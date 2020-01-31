export class IRequestUser {
<<<<<<< HEAD
<<<<<<< HEAD
  token: string;
  iat: number;
  owningOrgId: string | null;
=======
=======
  token: string;
>>>>>>> got create user refactored. added argon2. refactored auth and tokens.
  iat: number;
  owningOrdId: string | null;
>>>>>>> first draft of JWTs as tokens. need to refactor user service to verify
  userId: string | null;
}
