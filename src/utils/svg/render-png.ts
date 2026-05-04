/**
 * SVG → PNG conversion via @resvg/resvg-js.
 *
 * MCP clients (Cursor, Claude Desktop) reject image/svg+xml — only raster
 * formats are supported. This converts our SVG strings to PNG buffers.
 *
 * The import is dynamic because @resvg/resvg-js ships a native .node binary
 * that can fail to load when the host Node ABI doesn't match (e.g. Claude
 * Desktop's embedded Node). A top-level import would crash the entire server
 * at startup; dynamic import confines the failure to PNG rendering only.
 */

export interface RenderPngOptions {
  /** Scale factor for higher DPI output. Default 2 (retina). */
  scale?: number;
}

export async function svgToPngBase64(svgString: string, options?: RenderPngOptions): Promise<string> {
  const scale = options?.scale ?? 2;

  const { Resvg } = await import("@resvg/resvg-js");

  const resvg = new Resvg(svgString, {
    fitTo: { mode: "zoom", value: scale },
    font: {
      loadSystemFonts: false,
    },
  });

  const rendered = resvg.render();
  const pngBuffer = rendered.asPng();
  return Buffer.from(pngBuffer).toString("base64");
}
