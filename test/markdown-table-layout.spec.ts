import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdownTable } from "../frontend/src/utils/markdownPreview";
import {
  normalizeFieldDefinitions,
  placeholderTokenForField,
} from "../frontend/src/utils/template";

const rootDir = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(join(rootDir, relativePath), "utf8");

describe("Markdown table preview layout", () => {
  it("wraps rendered Markdown tables in an overflow container", () => {
    const component = readSource("frontend/src/components/DynamicDocument.tsx");
    const styles = readSource("frontend/src/styles.css");

    expect(component).toContain('className="markdown-table-wrap"');
    expect(styles).toMatch(/\.markdown-table-wrap\s*\{[^}]*max-width:\s*100%/s);
    expect(styles).toMatch(
      /\.markdown-table-wrap\s*\{[^}]*overflow-x:\s*auto/s,
    );
  });

  it("keeps long placeholders readable without expanding table cells indefinitely", () => {
    const component = readSource("frontend/src/components/DynamicDocument.tsx");
    const styles = readSource("frontend/src/styles.css");

    expect(component).toContain("title={displayValue}");
    expect(styles).toMatch(
      /\.markdown-table-wrap\s+\.inline-value\s*\{[^}]*(overflow-wrap:\s*anywhere|word-break:\s*break-word)/s,
    );
    expect(styles).toMatch(
      /\.markdown-table-wrap\s+\.inline-value\s*\{[^}]*text-overflow:\s*ellipsis/s,
    );
  });

  it("parses a wide business table with long typed placeholders", () => {
    const lines = [
      "| Nome | Ruolo | Azienda | Presenza | Note | Responsabile | Email |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| {{string:partecipante_1_nome}} | {{string:partecipante_1_ruolo}} | {{string:partecipante_1_azienda}} | {{string:partecipante_1_presenza}} | {{text:partecipante_1_note}} | {{string:partecipante_1_responsabile_operativo}} | {{email:partecipante_1_referente_email}} |",
    ];

    const table = parseMarkdownTable(lines, 0);

    expect(table?.header).toHaveLength(7);
    expect(table?.body[0]).toContain("{{string:partecipante_1_azienda}}");
    expect(table?.body[0]).toContain(
      "{{string:partecipante_1_responsabile_operativo}}",
    );
  });

  it("preserves the original raw placeholder token for display and saving", () => {
    const fields = normalizeFieldDefinitions(
      "| Azienda |\n| --- |\n| {{string:partecipante_1_azienda}} |",
    );

    expect(fields[0].rawPlaceholder).toBe("{{string:partecipante_1_azienda}}");
    expect(placeholderTokenForField(fields[0])).toBe(
      "{{string:partecipante_1_azienda}}",
    );
  });

  it("keeps existing Markdown table parsing behavior unchanged", () => {
    const lines = [
      "| ID | Servizio | Totale |",
      "| -- | -- | -- |",
      "| OF-01 | Dev Backend | {{currency:tot_backend}} |",
    ];

    expect(parseMarkdownTable(lines, 0)).toEqual(
      expect.objectContaining({
        next: 3,
        header: ["ID", "Servizio", "Totale"],
        body: [["OF-01", "Dev Backend", "{{currency:tot_backend}}"]],
      }),
    );
  });
});
