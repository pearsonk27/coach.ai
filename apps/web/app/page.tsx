// app/page.tsx -- T-40 hub: links to the live surfaces. No side effects, no fetch at build.
import Link from "next/link";

export default function HomePage() {
   return (
      <main className="home">
         <h1>coach.ai — MVP surfaces</h1>
          <nav className="nav">
             <Link href="/today" className="nav-item"><span className="k">T-51</span> Today&apos;s session</Link>
             <Link href="/play" className="nav-item"><span className="k">T-41</span> Play (Class Display)</Link>
             <Link href="/class" className="nav-item"><span className="k">T-40</span> Class Display (large)</Link>
             <Link href="/instructor" className="nav-item"><span className="k">T-41</span> Instructor remote</Link>
             <Link href="/me" className="nav-item"><span className="k">T-43</span> My playlist (music)</Link>
             <Link href="/cast" className="nav-item"><span className="k">T-60</span> Cast (tab-mirror)</Link>
             </nav>
          <p className="muted">
            The shared clock + cue scheduler + ducking math live in <code>@coach/ui</code> (type-safe,
            unit-tested); these pages are React views over it.
              </p>
      </main>
   );
}
