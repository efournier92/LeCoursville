import { PDFPrintRange } from './pdf-print-range';
export declare class PDFPrintService {
    performPrint: () => Promise<void>;
    filteredPageCount?: (pageCount: number, range: PDFPrintRange) => number;
    isInPDFPrintRange?: (pageIndex: number, printRange: PDFPrintRange) => boolean;
}
