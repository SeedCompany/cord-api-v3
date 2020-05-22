export interface Property {
  key: string;
  value: any;
  isOneActive?: boolean;
  labels: string[];
  addToAdminSg?: boolean;
  addToReaderSg?: boolean;
}
