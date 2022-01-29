/* eslint-disable @typescript-eslint/naming-convention */
import { LocationType } from '.';
import { ID } from '../../../common';

export interface TablesLocations {
  size: number;
  locations: TablesLocation[];
}

export interface TablesReadLocation {
  location: TablesLocation;
}

export interface TablesLocation {
  name: string;
  type: LocationType;
  iso_alpha_3: string;
  funding_account: ID;
  default_region: ID;
}
