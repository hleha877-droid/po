import { createRequire } from "node:module";
import { badRequest } from "../lib/errors.js";

const require = createRequire(import.meta.url);

// Extracts text + page count. Uses pdf-parse (pdf.js under the hood).
export async function extractPdf(buffer) {
  if (!buffer || buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw badRequest("The uploaded file is not a valid PDF.", "INVALID_PDF");
  }
  let pdfParse;
  try {
    pdfParse = require("pdf-parse/lib/pdf-parse.js");
  } catch (e) {
    throw badRequest("PDF parser unavailable.", "PDF_PARSER_UNAVAILABLE");
  }
  try {
    // pdf.js misreads Buffers that are views into a pooled ArrayBuffer — always hand it a clean copy.
    const clean = new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const data = await pdfParse(clean, { max: 0 });
    const text = cleanText(data.text || "");
    return { pages: data.numpages || 0, text, info: data.info || {} };
  } catch (e) {
    throw badRequest("We couldn't read this PDF. It may be encrypted or corrupted.", "INVALID_PDF");
  }
}

// Fast page count only (used for limit checks before doing full extraction).
export async function countPdfPages(buffer) {
  const { pages } = await extractPdf(buffer);
  return pages;
}

export function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/-\n(?=[a-zа-я])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Splits into chunks of PDF_CHUNK_SIZE characters and samples evenly so we never
// send an entire 500-page book to the LLM.
export function selectContext(text, maxChunks) {
  const size = Number(process.env.PDF_CHUNK_SIZE) || 8000;
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  if (chunks.length <= maxChunks) return { context: chunks.join("\n\n"), chunksUsed: chunks.length, chunksTotal: chunks.length };
  const picked = [];
  for (let i = 0; i < maxChunks; i++) picked.push(chunks[Math.floor((i * (chunks.length - 1)) / (maxChunks - 1))]);
  return { context: picked.join("\n\n[...]\n\n"), chunksUsed: maxChunks, chunksTotal: chunks.length };
}
