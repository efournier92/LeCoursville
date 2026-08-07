// Legacy Jasmine globals made available by src/test-setup.ts (Vitest runtime).
// Keep these declarations in sync with the shim.
declare function spyOn(obj: object, method: string): any;

declare namespace jasmine {
  type Spy = any;
  type SpyObj<T = any> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? Spy : T[K];
  } & Record<string, any>;
  function createSpyObj(name: string, methods: string[] | Record<string, unknown>, implementationObj?: Record<string, unknown>): any;
  function createSpy(name: string, fn?: (...args: unknown[]) => unknown): Spy;
  function any(c: unknown): any;
  function stringMatching(re: RegExp | string): any;
  function objectContaining(o: object): any;
}
