/** @type {import('next').NextConfig} */
const nextConfig = {
   reactStrictMode: true,
   // The shared packages ship their TS source as their type+main entry; transpile them so Next's
   // build consumes @coach/ui (pure core) + @coach/api-client (generated client) directly.
  transpilePackages: ["@coach/ui", "@coach/api-client"],
   // The MVP needs no network at build time; pages fetch the API at runtime only (NEXT_PUBLIC_*).
   // Skip Next's in-build TS/lint step: it auto-installs @types/node and mutates the shared lockfile
   // (a network side effect we avoid, lean policy); the dedicated `typecheck` gate runs the strict
   // `npx tsc -p apps/web/tsconfig.json` instead. It also avoids the /_global-error export crash.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};


export default nextConfig;
