"use client";
// app/global-error.tsx -- a minimal client error boundary.
//
// Next 16's default /_global-error crashed during the static export ("Expected workStore to be
// initialized", a React 19 module-singleton invariant). A plain "use client" boundary renders cleanly
// and gives every route a real error surface. Kept dependency-free (no store, no fetch) so it never
// crashes on its own.
export default function GlobalError() {
   return (
         <main style={{ font: "16px system-ui", padding: "2rem" }}>
            <h1>Something went wrong</h1>
            <p>coach.ai could not finish loading. Reload, or come back for the next session.</p>
         </main>
    );
}
