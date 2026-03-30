/**
 * SVG → PNG conversion via @resvg/resvg-js.
 *
 * MCP clients (Cursor, Claude Desktop) reject image/svg+xml — only raster
 * formats are supported. This converts our SVG strings to PNG buffers.
 */

import { Resvg } from "@resvg/resvg-js";

export interface RenderPngOptions {
  /** Scale factor for higher DPI output. Default 2 (retina). */
  scale?: number;
}

export function svgToPngBase64(svgString: string, options?: RenderPngOptions): string {
  const scale = options?.scale ?? 2;

  const resvg = new Resvg(svgString, {
    fitTo: { mode: "zoom", value: scale },
    font: {
      // Avoid scanning OS font dirs — can exceed CI test timeouts on Node 20 runners;
      // our SVG builders set explicit font-family stacks resvg can resolve without that scan.
      loadSystemFonts: false,
    },
  });

  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();
  return Buffer.from(pngBuffer).toString("base64");
}
