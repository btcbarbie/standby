import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Inter({ variable: "--nf-sans", subsets: ["latin"] });
const display = Instrument_Serif({ variable: "--nf-display", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Standby",
  description: "Tell it exactly what you want. It waits. It buys only when two independent checks agree.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
