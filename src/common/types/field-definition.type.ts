export type FieldType =
  | "text" // input singola riga
  | "textarea" // testo multi-riga
  | "number" // numero
  | "date" // data (YYYY-MM-DD)
  | "boolean" // checkbox si/no
  | "email" // email (validazione frontend)
  | "url" // link/URL
  | "tel" // numero di telefono
  | "select" // scelta da lista (opzioni in defaultValue separato da virgola)
  | "currency"; // importo monetario (es. € 1.000,00)

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: string;
}
