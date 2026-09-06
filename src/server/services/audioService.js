// Combines per-line WAV segments into the final episode. Uses FFmpeg (-> MP3) when available,
// otherwise falls back to native WAV concatenation so the product still works.
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseWav, wavHeader, silenceWav } from "./ttsService.js";

let ffmpegCache = null;
export async function hasFfmpeg() {
  if (ffmpegCache !== null) return ffmpegCache;
  ffmpegCache = await new Promise((resolve) => {
    try {
      const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]);
      p.on("error", () => resolve(false));
      p.on("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return ffmpegCache;
}

function concatWav(buffers) {
  const parsed = buffers.map(parseWav);
  const { sampleRate, channels } = parsed[0];
  const data = Buffer.concat(parsed.map((p) => p.data));
  const durationSeconds = data.length / (sampleRate * channels * 2);
  return { buffer: Buffer.concat([wavHeader(data.length, sampleRate, channels), data]), durationSeconds };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
}

/**
 * @param {Buffer[]} segments WAV buffers in order
 * @returns {{buffer: Buffer, format: 'mp3'|'wav', durationSeconds: number}}
 */
export async function combineSegments(segments, { gapSeconds = 0.45 } = {}) {
  const sampleRate = parseWav(segments[0]).sampleRate;
  const withGaps = [];
  segments.forEach((s, i) => {
    withGaps.push(s);
    if (i < segments.length - 1) withGaps.push(silenceWav(gapSeconds, sampleRate));
  });
  const wav = concatWav(withGaps);
  if (!(await hasFfmpeg())) return { buffer: wav.buffer, format: "wav", durationSeconds: wav.durationSeconds };

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "podmind-"));
  const input = path.join(dir, "episode.wav");
  const output = path.join(dir, "episode.mp3");
  try {
    await fsp.writeFile(input, wav.buffer);
    await runFfmpeg(["-y", "-i", input, "-codec:a", "libmp3lame", "-q:a", "4", "-ar", "44100", output]);
    const mp3 = await fsp.readFile(output);
    return { buffer: mp3, format: "mp3", durationSeconds: wav.durationSeconds };
  } catch (e) {
    console.warn("ffmpeg failed, falling back to WAV:", e.message);
    return { buffer: wav.buffer, format: "wav", durationSeconds: wav.durationSeconds };
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
