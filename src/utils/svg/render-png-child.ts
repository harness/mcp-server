/**
 * Child-process entry point for SVG → PNG conversion.
 *
 * Runs in a separate Node process so a native resvg panic (SIGSEGV) cannot
 * kill the MCP server. Reads JSON from stdin, writes JSON to stdout.
 */
import { text } from "node:stream/consumers";
import { stdin } from "node:process";

interface ChildInput {
  svg: string;
  scale?: number;
}

async function main(): Promise<void> {
  const raw = await text(stdin);
  const { svg, scale } = JSON.parse(raw) as ChildInput;

  if (typeof svg !== "string" || !svg) {
    process.stderr.write("Missing svg input");
    process.exit(1);
  }

  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale ?? 2 },
    font: {
      loadSystemFonts: false,
    },
  });

  const pngBuffer = resvg.render().asPng();
  process.stdout.write(JSON.stringify({ base64: Buffer.from(pngBuffer).toString("base64") }));
}

main().catch((err: unknown) => {
  process.stderr.write(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
