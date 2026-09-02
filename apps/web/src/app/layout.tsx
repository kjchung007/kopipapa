import type { Metadata } from "next";
import { MotionInit, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { orderUrl } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = { metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),title:{default:"Kopi Papa | Born in Sarawak",template:"%s | Kopi Papa"},description:"Traditional local kopi meets modern coffee culture. Born in Sarawak and brewed forward.",openGraph:{title:"Kopi Papa",description:"Born in Sarawak. Brewed forward.",images:["/assets/customer-cup.webp"]} };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><MotionInit/><SiteHeader orderUrl={orderUrl}/>{children}<SiteFooter orderUrl={orderUrl}/></body>
    </html>
  );
}
