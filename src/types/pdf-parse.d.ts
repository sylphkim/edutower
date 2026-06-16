declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  function pdfParse(buffer: Buffer): Promise<PDFData>;

  export = pdfParse;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFData {
    text: string;
    numpages: number;
  }

  function pdfParse(buffer: Buffer): Promise<PDFData>;

  export = pdfParse;
}
