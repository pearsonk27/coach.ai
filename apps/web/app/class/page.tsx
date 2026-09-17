"use client";
// app/class/page.tsx -- T-40 Class Display (large-screen cast target) + T-60 cast bar.
import { ClassDisplay } from "../../components/ClassDisplay";
import { CastBar } from "../../components/CastBar";

export default function ClassPage() {
   return (
      <div className="class-page">
        <ClassDisplay />
         <CastBar />
            </div>
    );
}
