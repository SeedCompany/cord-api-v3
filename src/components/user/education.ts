import { Degree } from './degree';

export interface Education {
  readonly id: string;
  degree: Degree;
  major: string;
  institution: string;
}
