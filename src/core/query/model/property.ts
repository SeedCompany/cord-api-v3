export interface Property {
  key: string;
  value: any;
  isPropertyArray?: boolean;
  oldValue?: any;
  labels: string[];
  addToAdminSg?: boolean;
  addToReaderSg?: boolean;
}
