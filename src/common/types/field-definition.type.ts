export type FieldType = "text" | "number" | "date" | "boolean" | "textarea";

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: string;
}
