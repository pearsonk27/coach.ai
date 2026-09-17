import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
   title: "coach.ai",
   description: "HIIT class runner — web player, class display, instructor remote.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
     <html lang="en">
      <body>{children}</body>
     </html>
   );
}
