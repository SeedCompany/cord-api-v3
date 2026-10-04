import { Field, InputType } from '@nestjs/graphql';

@InputType()
export abstract class LoginWithAuth0Input {
  @Field({ description: 'The Auth0-issued ID token (JWT) to verify' })
  idToken: string;
}
