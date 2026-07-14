"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "How much did I spend this month?",
  "How much did I spend last month in cashflow mode?",
  "What is my biggest category this month?",
  "Show my subscriptions",
  "What are my upcoming dues?",
  "How are my budgets looking?",
  "Any spending anomalies?",
];

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [grounded, setGrounded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion(text);
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setAnswer(json.data.answer);
      setSource(json.data.source);
      setGrounded(json.data.groundedAnswer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-50 px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="mb-2 inline-flex items-center rounded-full border border-violet-300/60 bg-violet-100/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-800">
            Ask your money
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Natural-language Q&A</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Questions are parsed into intents, answered from your calc APIs, then optionally polished by LLM.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white/85 p-6 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              placeholder="e.g. How much did I spend on food last month?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
            />
            <button
              type="button"
              onClick={() => ask()}
              disabled={loading || !question.trim()}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading ? "Thinking…" : "Ask"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                {s}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

          {answer && (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-4 text-sm text-zinc-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Answer
                  </span>
                  {source && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-200">
                      {source}
                    </span>
                  )}
                </div>
                <p className="leading-relaxed">{answer}</p>
              </div>
              {grounded && grounded !== answer && (
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold">Grounded calc:</span> {grounded}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
