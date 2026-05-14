import { validateMarkdownContent } from "../src/common/utils/markdown.utils";

describe("markdown validation security guards", () => {
  it("does not hang with many unclosed delimiters", () => {
    const payload = "{{".repeat(10_000);
    const start = Date.now();
    const result = validateMarkdownContent(payload, 200_000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(result.valid).toBe(false);
  });

  it("blocks dangerous latex I/O commands", () => {
    const result = validateMarkdownContent(
      "# T\n{{string:titolo}}\n\\input{/etc/passwd}",
      100_000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("LaTeX");
  });

  it("blocks html script and iframe tags", () => {
    const script = validateMarkdownContent(
      "# T\n{{string:titolo}}\n<script>alert(1)</script>",
      100_000,
    );
    const iframe = validateMarkdownContent(
      "# T\n{{string:titolo}}\n<iframe src='x'/>",
      100_000,
    );
    expect(script.valid).toBe(false);
    expect(iframe.valid).toBe(false);
  });
});
