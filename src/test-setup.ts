// Jasmine → Vitest compat shim for legacy specs migrated from Karma/Jasmine.
// Loaded via the unit-test builder's `setupFiles` option.
import 'zone.js';
import 'zone.js/testing';
import { vi, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TestSharedModule } from './test-shared.module';

// ponytail: import AppModule to give the AOT template compiler the module scope
// that declares all components and imports MaterialModule etc.
import { AppModule } from './app/app.module';

// Globally import shared module so that all spec TestBed configs have access
TestBed.configureTestingModule({
  imports: [TestSharedModule, AppModule],
});

(globalThis as any).spyOn = vi.spyOn;

function makeSpy(fn?: (...args: unknown[]) => unknown): any {
  const spy = fn ? vi.fn(fn) : vi.fn();
  // ponytail: jasmine-compat `.and` chain for legacy spy API
  (spy as any).and = {
    callFake: (f: (...args: unknown[]) => unknown) => spy.mockImplementation(f),
    returnValue: (val: unknown) => spy.mockReturnValue(val),
    returnValues: (...vals: unknown[]) => { vals.forEach(v => spy.mockReturnValueOnce(v)); return (spy as any).and; },
  };
  return spy;
}

(globalThis as any).jasmine = {
  createSpyObj: (name: string, methods: string[] | Record<string, unknown>, implementationObj?: Record<string, unknown>) => {
    const obj: Record<string, unknown> = {};
    if (Array.isArray(methods)) {
      methods.forEach(m => { obj[m] = makeSpy(); });
    } else {
      Object.entries(methods).forEach(([k, v]) => {
        obj[k] = typeof v === 'function' ? makeSpy(v as (...args: unknown[]) => unknown) : v;
      });
    }
    // ponytail: 3-arg createSpyObj from legacy jasmine — merge implementationObj properties
    if (implementationObj) {
      Object.entries(implementationObj).forEach(([k, v]) => {
        if (!(k in obj)) { obj[k] = v; }
      });
    }
    return obj;
  },
  createSpy: (name: string, fn?: (...args: unknown[]) => unknown) => makeSpy(fn),
  any: (c: unknown) => expect.anything(),
  stringMatching: (re: RegExp | string) => expect.stringMatching(re),
  objectContaining: (o: object) => expect.objectContaining(o),
};
