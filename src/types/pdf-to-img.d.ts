declare module "pdf-to-img" {
  export interface PdfOptions {
    password?: string;
    scale?: number;
  }

  export interface PdfDocument {
    length: number;
    getPage(pageNumber: number): Promise<Buffer>;
    [Symbol.asyncIterator](): AsyncIterator<Buffer>;
  }

  export function pdf(input: string | Buffer, options?: PdfOptions): Promise<PdfDocument>;
}
