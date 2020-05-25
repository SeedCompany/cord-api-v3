export interface Property {
  key: string;
  value: any;
  isSingleton: boolean;
  oldValue?: any;
  labels: string[];
  addToAdminSg?: boolean;
  addToReaderSg?: boolean;
}
