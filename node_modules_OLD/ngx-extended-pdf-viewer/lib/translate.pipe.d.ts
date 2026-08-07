import { PipeTransform } from '@angular/core';
import { PDFNotificationService } from './pdf-notification-service';
import * as i0 from "@angular/core";
export declare class TranslatePipe implements PipeTransform {
    private PDFViewerApplication;
    constructor(notificationService: PDFNotificationService);
    transform(key: string, fallback: string): Promise<string | undefined>;
    translate(key: string, englishText: string): Promise<string | undefined>;
    static ɵfac: i0.ɵɵFactoryDeclaration<TranslatePipe, never>;
    static ɵpipe: i0.ɵɵPipeDeclaration<TranslatePipe, "translate", false>;
}
