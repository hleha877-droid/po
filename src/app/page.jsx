"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { MarketingNav } from "@/components/Nav";
import PricingCards from "@/components/PricingCards";
import { Waveform } from "@/components/GenerationProgress";
import { Logo } from "@/components/ui";

const STEPS = [
  { t: "Upload a PDF", d: "Reports, papers, textbooks, contracts — up to 500 pages.", i: "📄" },
  { t: "AI understands it", d: "PodMind reads the document and writes a natural spoken script.", i: "🧠" },
  { t: "Real voices speak", d: "Natural Russian and English voices bring it to life.", i: "🎙️" },
  { t: "Listen anywhere", d: "Stream, download the MP3 or share a public page.", i: "🎧" },
];
const MODES = [
  { n: "Quick Summary", d: "The essentials in 5–10 minutes.", free: true },
  { n: "Deep Dive", d: "Every important idea, explained." },
  { n: "Two Hosts", d: "A lively back-and-forth conversation." },
  { n: "Study Mode", d: "Definitions, examples, questions, recaps." },
  { n: "Debate Mode", d: "One explains, one challenges — grounded in the text." },
];

export default function Landing() {
  return (
    <>
      <MarketingNav />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,108,255,0.25),transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16 sm:pt-28 text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="badge badge-pro mx-auto">AI podcasts from any PDF</motion.div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
              Turn documents into <span className="gradient-text">conversations</span> you actually want to hear.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-auto mt-6 max-w-2xl text-lg muted">
              PodMind AI reads your PDF, writes a natural podcast script and voices it with lifelike AI hosts. Learn on your commute, at the gym, anywhere.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className="btn btn-primary px-6 py-3 text-base">Try Free — 3 podcasts a month</Link>
              <Link href="/pricing" className="btn btn-secondary px-6 py-3 text-base">See pricing</Link>
            </motion.div>
            <p className="mt-3 text-xs muted">No credit card required. Cancel anytime.</p>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }} className="glass-strong mx-auto mt-14 max-w-3xl rounded-3xl p-6 sm:p-8 text-left">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-2xl">♫</div>
                <div className="min-w-0">
                  <div className="text-xs muted">Two Hosts · Russian · 12 min</div>
                  <div className="truncate font-semibold text-lg">Attention Is All You Need — разбор для тех, кто спешит</div>
                </div>
              </div>
              <Waveform className="mt-5" />
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-violet-300 font-semibold">Aidar:</span> Итак, главная идея статьи — отказаться от рекуррентных сетей и целиком положиться на механизм внимания.</p>
                <p><span className="text-cyan-300 font-semibold">Kseniya:</span> Звучит смело. А что это даёт на практике?</p>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div key={s.t} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="card p-6">
                <div className="text-3xl">{s.i}</div>
                <div className="mt-3 font-semibold">{s.t}</div>
                <p className="mt-1 text-sm muted">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <div className="grid gap-8 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold">Five ways to listen</h2>
              <p className="mt-3 muted">Pick the format that matches how you learn. Quick Summary is free forever — Pro unlocks the rest.</p>
              <ul className="mt-6 space-y-3">
                {MODES.map((m) => (
                  <li key={m.n} className="flex items-start gap-3">
                    <span className={`mt-0.5 ${m.free ? "badge badge-free" : "badge badge-pro"}`}>{m.free ? "Free" : "Pro"}</span>
                    <div>
                      <div className="font-medium">{m.n}</div>
                      <div className="text-sm muted">{m.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6 sm:p-8">
              <h3 className="font-semibold text-lg">Russian that sounds human</h3>
              <p className="mt-2 text-sm muted">Our prompts are tuned for natural spoken Russian — no literal translations, no bureaucratic phrasing. Voiced by Silero's Aidar and Kseniya.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[["Aidar", "male"], ["Kseniya", "female"]].map(([n, g]) => (
                  <div key={n} className="rounded-2xl bg-white/5 p-4">
                    <div className="text-2xl">{g === "male" ? "🧑" : "👩"}</div>
                    <div className="mt-2 font-medium">{n}</div>
                    <div className="text-xs muted">Russian · {g}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <h2 className="text-center text-3xl font-bold">Simple, honest pricing</h2>
          <p className="mt-2 text-center muted">Start free. Upgrade when you need more. Cancel anytime.</p>
          <div className="mt-12"><PricingCards compact /></div>
        </section>

        <footer className="border-t border-white/5 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm muted">
            <Logo />
            <div className="flex gap-6"><Link href="/pricing">Pricing</Link><Link href="/login">Sign in</Link><Link href="/register">Get started</Link></div>
            <span>© {new Date().getFullYear()} PodMind AI</span>
          </div>
        </footer>
      </main>
    </>
  );
}
