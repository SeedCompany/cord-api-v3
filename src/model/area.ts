import { Region } from './region';

export interface Area {
  id: string;
  name: string | null;
  region: Region;
}
