import { scoutProvider } from "@/lib/ai";
import Header from "@/components/home/Header";
import Hero from "@/components/home/Hero";
import Team from "@/components/home/Team";
import Guardrails from "@/components/home/Guardrails";
import HowItWorks from "@/components/home/HowItWorks";
import Transparency from "@/components/home/Transparency";
import { FinalCta, Footer } from "@/components/home/FinalCta";

// Reads which AI runs Scout on this server, so the page never claims two companies when there's one.
export const dynamic = "force-dynamic";

export default function Landing() {
  const scoutMaker = scoutProvider() === "Gemini" ? "Google Gemini" : "Anthropic Claude";
  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sr-only rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero twoCompanies={scoutMaker !== "Anthropic Claude"} />
        <Team scoutMaker={scoutMaker} />
        <Guardrails />
        <HowItWorks />
        <Transparency />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
