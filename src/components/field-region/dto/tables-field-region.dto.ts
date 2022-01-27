/* eslint-disable @typescript-eslint/naming-convention */
import { ID } from '../../../common';

export interface TablesFieldRegions {
  size: number;
  fieldRegions: TablesFieldRegion[];
}

export interface TablesReadFieldRegion {
  fieldRegion: TablesFieldRegion;
}

export interface TablesFieldRegion {
  name: string;
  director: ID;
  field_zone: ID;
}
