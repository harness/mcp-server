import { describe, it, expect } from "vitest";
import { formatBodyPreview } from "../../src/utils/body-preview.js";

describe("formatBodyPreview", () => {
  it("redacts content and content_base64 fields in object bodies", () => {
    const preview = formatBodyPreview({
      identifier: "my-file",
      content: "super-secret-payload",
      content_base64: "c3VwZXItc2VjcmV0",
    });

    expect(preview).toContain('"identifier": "my-file"');
    expect(preview).not.toContain("super-secret-payload");
    expect(preview).not.toContain("c3VwZXItc2VjcmV0");
    expect(preview).toMatch(/\[redacted \d+ bytes\]/);
  });

  it("redacts contentBase64 camelCase alias", () => {
    const preview = formatBodyPreview({
      contentBase64: "YWJj",
    });

    expect(preview).not.toContain("YWJj");
    expect(preview).toMatch(/\[redacted \d+ bytes\]/);
  });

  it("parses JSON string bodies before redacting nested secrets", () => {
    const preview = formatBodyPreview(
      JSON.stringify({
        connector: { identifier: "k8s", content: "ssh-private-key-material" },
      }),
    );

    expect(preview).toContain('"identifier": "k8s"');
    expect(preview).not.toContain("ssh-private-key-material");
    expect(preview).toMatch(/\[redacted \d+ bytes\]/);
  });

  it("truncates long YAML string bodies without exposing full payload", () => {
    const yaml = `connector:\n  name: Long\n  spec:\n${"    line: value\n".repeat(80)}`;
    const preview = formatBodyPreview(yaml);

    expect(preview.length).toBeLessThan(yaml.length);
    expect(preview).toContain("...(truncated");
  });

  it("truncates oversized JSON previews", () => {
    const body = { rows: Array.from({ length: 400 }, (_, i) => ({ id: i, label: `row-${i}` })) };
    const preview = formatBodyPreview(body);

    expect(preview.length).toBeLessThanOrEqual(2_100);
    expect(preview).toContain("...(truncated");
  });

  it("preserves zero and false values in previews", () => {
    const preview = formatBodyPreview({
      timeout_ms: 0,
      enabled: false,
      name: "safe",
    });

    expect(preview).toContain('"timeout_ms": 0');
    expect(preview).toContain('"enabled": false');
    expect(preview).toContain('"name": "safe"');
  });
});
