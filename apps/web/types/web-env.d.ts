// Ambient types for the web app WITHOUT taking a new npm dependency (lean policy).
// Next inlines NEXT_PUBLIC_* at build; we declare `process` minimally so strict tsc accepts the
// reads in lib/env.ts without pulling @types/node.
declare const process: {
  readonly env: {
    readonly NEXT_PUBLIC_API_BASE_URL?: string;
    readonly NODE_ENV?: string;
    readonly [key: string]: string | undefined;
  };
};
