export type FieldType =
  | "string"
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "date"
  | "boolean"
  | "phone"
  | "checkbox"
  | "email"
  | "url"
  | "tel"
  | "select"
  | "currency"
  | "percentage"
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
  source?: "template";
  placeholder?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}
