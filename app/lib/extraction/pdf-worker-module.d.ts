// Minimal ambient declaration - pdfjs-dist doesn't ship types for its raw
// worker entry module (only for the main pdf.mjs API surface). We only
// import this module for its side effect of registering WorkerMessageHandler
// on the module namespace object; see serverPdfText.ts for why.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  const mod: unknown;
  export default mod;
}
