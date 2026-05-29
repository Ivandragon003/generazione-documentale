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
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
  listName?: string;
  listLabel?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  maxLength?: number;
  defaultValue: string;
  source?: "template";
  placeholder?: string;
  listName?: string;
  listLabel?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}
