declare module "pdf-parse" {
  interface PdfParseTextResult {
    text: string
  }

  class PDFParse {
    constructor(options: { data: Buffer })
    getText(): Promise<PdfParseTextResult>
    destroy(): Promise<void>
  }

  export { PDFParse }
}
