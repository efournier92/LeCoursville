import { IPDFViewerApplication } from '../public_api';
import * as i0 from "@angular/core";
export declare class NgxKeyboardManagerService {
    /** Allows the user to disable the keyboard bindings completely */
    ignoreKeyboard: boolean;
    /** Allows the user to disable a list of key bindings. */
    ignoreKeys: Array<string>;
    /** Allows the user to enable a list of key bindings explicitly. If this property is set, every other key binding is ignored. */
    acceptKeys: Array<string>;
    constructor();
    isKeyIgnored(cmd: number, keycode: number | 'WHEEL'): boolean;
    private isKeyInList;
    private isKey;
    registerKeyboardListener(PDFViewerApplication: IPDFViewerApplication): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<NgxKeyboardManagerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<NgxKeyboardManagerService>;
}
