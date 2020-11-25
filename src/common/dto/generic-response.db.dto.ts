export class GenericResponse {
  success: boolean;
  message: string;
}

export class CreateResponse extends GenericResponse {
  id: string;
}
