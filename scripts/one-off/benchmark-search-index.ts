import { performance } from "node:perf_hooks";
import { buildIndex } from "@/libs/search/buildIndex";
import { searchDocuments } from "@/libs/search/rank";
import type { SearchDocument } from "@/libs/search/types";

const seedArgument = process.argv.find((argument) => argument.startsWith("--seed="));
const seed = Number(seedArgument?.slice(7) ?? "20260911");
const random = (() => { let state = seed >>> 0; return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();
const words = ["Rimuru", "Tempest", "ริมูรุ", "เทมเพส", "forest", "ป่า", "magic", "เวทมนตร์"];
const sentence = () => Array.from({ length: 15 + Math.floor(random() * 40) }, () => words[Math.floor(random() * words.length)]).join(" ");
const fixture = (count: number): SearchDocument[] => Array.from({ length: count }, (_, index) => ({ id: `note:benchmark:v:c${Math.floor(index / 20)}:${index}`, type: "note", novelId: "benchmark", volumeId: "v", chapterId: `c${Math.floor(index / 20)}`, noteId: String(index), content: sentence(), referenceIds: [], referenceNames: index % 10 ? [] : ["Rimuru Tempest"], referenceTypes: index % 10 ? [] : ["character"], aliases: [], tagIds: [], tags: index % 5 ? [] : ["Arc"], route: "/" }));
const percentile = (values: number[], ratio: number) => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * ratio)];

function benchmark(count: number) {
  global.gc?.();
  const documents = fixture(count), map = new Map(documents.map((document) => [document.id, document]));
  const heapBefore = process.memoryUsage().heapUsed, buildStarted = performance.now(), index = buildIndex(documents), buildMs = performance.now() - buildStarted;
  const latency = (query: string) => { searchDocuments(index, map, query, { kind: "global" }); const timings = Array.from({ length: 30 }, () => { const started = performance.now(); searchDocuments(index, map, query, { kind: "global" }); return performance.now() - started; }); return { p50: percentile(timings, .5), p95: percentile(timings, .95) }; };
  const exact = latency("Rimuru"), fuzzy = latency("Rimurru");
  const mutationStarted = performance.now();
  documents.slice(0, Math.min(500, documents.length)).forEach((document) => index.replace({ ...document, content: `${document.content} updated` }));
  documents.slice(500, Math.min(1000, documents.length)).forEach((document) => index.discard(document.id));
  console.log(JSON.stringify({ checkpoint: count, documents: count, firestoreSourceBytes: "N/A", searchDatasetBytes: Buffer.byteLength(JSON.stringify(documents)), buildMs, nodeHeapDeltaBytes: process.memoryUsage().heapUsed - heapBefore, exact, fuzzy, mutationMaintenanceMs: performance.now() - mutationStarted, browserHeap: "unavailable" }));
}

console.log(JSON.stringify({ seed, realBaseline: process.argv.includes("--real-baseline") ? "not implemented: use an authorized non-production export" : "not requested" }));
[5000, 10000, 25000, 50000].forEach(benchmark);
