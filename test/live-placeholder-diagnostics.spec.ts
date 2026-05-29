import { analyzeLivePlaceholderIssues } from "../frontend/src/utils/livePlaceholderDiagnostics";

describe("livePlaceholderDiagnostics", () => {
  it("returns no issues for valid placeholders", () => {
    const markdown = [
      "{{string:nome_cliente}}",
      "{{integer:durata_mesi:3:false}}",
      "{{list:tipo:30:true:Tipologia,Standard,Premium}}",
    ].join("\n");

    expect(analyzeLivePlaceholderIssues(markdown)).toEqual([]);
  });

  it("reports official csv list placeholders without options", () => {
    const [issue] = analyzeLivePlaceholderIssues(
      "{{list:stato_cliente:100:true:Stato}}",
    );

    expect(issue).toEqual(
      expect.objectContaining({
        severity: "error",
        message: "Invalid list placeholder: missing options.",
      }),
    );
  });

  it("reports invalid placeholder type with suggestion", () => {
    const [issue] = analyzeLivePlaceholderIssues("{{strng:nome_cliente}}");
    expect(issue).toEqual(
      expect.objectContaining({
        severity: "error",
        message: 'Invalid placeholder type: "strng". Did you mean "string"?',
      }),
    );
  });

  it("reports malformed length and required flag", () => {
    const issues = analyzeLivePlaceholderIssues("{{string:nome:abc:yes}}");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("Invalid length");
  });

  it("reports missing list options with the official syntax hint", () => {
    const [issue] = analyzeLivePlaceholderIssues(
      "{{list:priorita:100:true:Priorità:}}",
    );

    expect(issue).toEqual(
      expect.objectContaining({
        severity: "error",
        message: "Invalid list placeholder: missing options.",
        suggestion:
          "Example: {{list:priorita:100:true:Priorità:bassa,media,alta}}",
      }),
    );
  });

  it("reports list-only parameters on non-list placeholders", () => {
    const [issue] = analyzeLivePlaceholderIssues(
      "{{string:nome_cliente:100:true:stati_cliente:Attivo,Sospeso}}",
    );

    expect(issue).toEqual(
      expect.objectContaining({
        severity: "error",
        message:
          "Invalid placeholder format: label and list options are only allowed for list placeholders.",
      }),
    );
  });

  it("reports unmatched closing token", () => {
    const [issue] = analyzeLivePlaceholderIssues("foo }}");
    expect(issue).toEqual(
      expect.objectContaining({
        severity: "error",
        message: "Placeholder closing token without opening token.",
      }),
    );
  });

  it("reports unclosed placeholder as warning", () => {
    const [issue] = analyzeLivePlaceholderIssues("{{string:nome_cliente");
    expect(issue).toEqual(
      expect.objectContaining({
        severity: "warning",
        message: "Unclosed placeholder. Missing }}",
      }),
    );
  });

  it("reports accented field_name as invalid format", () => {
    const [issue] = analyzeLivePlaceholderIssues(
      "{{string:unità_responsabile}}",
    );
    expect(issue).toEqual(
      expect.objectContaining({
        severity: "error",
        message: expect.stringContaining("Invalid placeholder format"),
      }),
    );
  });

  it("returns real line/column for errors in multi-line template", () => {
    const markdown = [
      "# Titolo",
      "Riga valida: {{string:nome_cliente}}",
      "Riga invalida: {{strng:nome_cliente}}",
    ].join("\n");
    const issue = analyzeLivePlaceholderIssues(markdown).find((item) =>
      item.message.includes('Invalid placeholder type: "strng"'),
    );
    expect(issue).toEqual(
      expect.objectContaining({
        line: 3,
        column: 16,
      }),
    );
  });
});
