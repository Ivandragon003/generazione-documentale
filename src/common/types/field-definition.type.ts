export type FieldType = "text" | "number" | "date" | "boolean";

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: string;
}
