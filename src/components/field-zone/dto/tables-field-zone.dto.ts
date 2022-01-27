/* eslint-disable @typescript-eslint/naming-convention */
import { ID } from '../../../common';

export interface TablesFieldZones {
  size: number;
  fieldZones: TablesFieldZone[];
}

export interface TablesReadFieldZone {
  fieldZone: TablesFieldZone;
}

export interface TablesFieldZone {
  name: string;
  director: ID;
}
