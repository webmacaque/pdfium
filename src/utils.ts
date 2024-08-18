import { renderBySharp } from "./renderer/sharp";
import type { PDFiumRenderFunction, PDFiumRenderOptions } from "./types";

export async function convertBitmapToImage(
  options: {
    render: PDFiumRenderFunction;
  } & PDFiumRenderOptions,
): Promise<Uint8Array> {
  switch (options.render) {
    case "sharp":
      return await renderBySharp(options);
    case "bitmap":
      return options.data;
    default:
      return await options.render(options);
  }
}

export function readUInt16LE(buffer: Uint8Array, offset = 0): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}
