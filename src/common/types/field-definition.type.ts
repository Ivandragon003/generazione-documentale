export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "boolean"
  | "checkbox"
  | "email"
  | "url"
  | "tel"
  | "select"
  | "currency"
  | "table"
  | "subtable"
  | "list"
  | "repeater";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldColumnDefinition {
  name: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: string;
  placeholder?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}
