"use client";
import { MarketingNav } from "@/components/Nav";
import PricingCards, { ComparisonTable } from "@/components/PricingCards";

const FAQ = [
  ["What counts as an audio minute?", "The final length of each generated podcast. If a podcast is 12 minutes long, 12 minutes are deducted from your monthly allowance. Regenerating audio counts again."],
  ["What happens when I hit a limit?", "Generation stops before any AI work starts and we show you exactly which limit was reached. Nothing is charged for blocked requests."],
  ["Can I cancel?", "Yes — cancel anytime from Settings → Billing. You keep your plan features until the end of the current billing period."],
  ["Do Free podcasts have a watermark?", "Free public sharing isn't available; Pro and Creator public pages have no PodMind watermark."],
];

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="text-center">
          <div className="badge badge-pro mx-auto">Pricing</div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">Plans for every kind of listener</h1>
          <p className="mt-4 muted max-w-xl mx-auto">Free covers the basics. Pro unlocks the full studio. Creator is for people who publish. Cancel anytime.</p>
        </div>
        <div className="mt-14"><PricingCards /></div>
        <h2 className="mt-20 text-2xl font-bold text-center">Compare plans</h2>
        <div className="mt-8"><ComparisonTable /></div>
        <h2 className="mt-20 text-2xl font-bold text-center">Questions</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="card p-5"><div className="font-semibold">{q}</div><p className="mt-2 text-sm muted">{a}</p></div>
          ))}
        </div>
      </main>
    </>
  );
}
