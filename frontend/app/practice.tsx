"use client";

import { useEffect, useState } from "react";

export type PracticeQuestion = {
  id: string; paper_id: string; year: number; exam: string;
  question_number: string; page_number: number | null; text: string;
  module: string; topic: string;
};

type Rating = "Got it" | "Needs work" | "Retry later";
type Entry = { question: PracticeQuestion; rating: Rating };
type Paper = { id: string; module: string; exam: string; year: number };
const key = "exam-search.practice.v1";
const button = "rounded-md border border-[#8a9182] px-3 py-2 text-sm font-medium hover:bg-[#dbe2d4]";

function readProgress(): Record<string, Entry> {
  const value = JSON.parse(localStorage.getItem(key) || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
  return value;
}

export default function Practice({ questions, papers, url, api }: {
  api: string; questions: PracticeQuestion[]; papers: Paper[];
  url: (id: string, page?: number | null) => string;
}) {
  const [session, setSession] = useState(questions);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<Record<string, Entry>>({});
  const [notice, setNotice] = useState("");
  const [module, setModule] = useState(questions[0]?.module || "");
  const [loading, setLoading] = useState(false);
  const modules = [...new Set(papers.map(paper => paper.module))].sort();
  const modulePapers = papers.filter(paper => paper.module === module)
    .sort((a, b) => b.year - a.year || a.exam.localeCompare(b.exam));

  const [paperId, setPaperId] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [end, setEnd] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    function refresh() {
      try { setProgress(readProgress()); }
      catch { setNotice("Your browser could not read saved practice progress."); }
    }
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  useEffect(() => {
    if (!end) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= end) {
        window.clearInterval(timer);
        setNotice("Time is up.");
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [end]);

  const question = session[index];
  const queue = Object.values(progress).filter(entry => entry.question.module === module && entry.rating !== "Got it" &&
    papers.some(paper => paper.id === entry.question.paper_id));
  function rate(rating: Rating) {
    try {
      const next = { ...readProgress(), [question.id]: { question, rating } };
      localStorage.setItem(key, JSON.stringify(next));
      setProgress(next);
      setIndex(index + 1);
      setNotice(index + 1 === session.length ? "Practice session complete." : "");
    } catch { setNotice("Progress could not be saved. Check browser storage and try again."); }
  }
  async function startPaper() {
    const paper = modulePapers.find(item => item.id === paperId);
    if (!paper) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`${api}/papers/${paper.id}/questions`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const groups: {
        question_number: string;
        sub_questions: { id: string; label: string; page_number: number | null; text: string }[];
      }[] = await response.json();
      const items = groups.flatMap(group => group.sub_questions.map(part => ({
        id: part.id, paper_id: paper.id, module: paper.module, year: paper.year, exam: paper.exam,
        question_number: String(group.question_number) + (part.label || ""),
        page_number: part.page_number, text: part.text, topic: "Past-paper practice",
      })));
      setSession(items);
      setIndex(0);
      if (!items.length) setNotice("This paper has no indexed questions. Choose another paper.");
    } catch {
      setNotice("Could not load this paper. Check the backend and try again.");
    } finally {
      setLoading(false);
    }
  }
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return <section className="max-w-3xl space-y-7">
    <h1 className="text-3xl font-semibold">Practice</h1>
    <div className="grid gap-4 border-b border-[#cbc5b4] pb-5 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">Module
        <select className={button + " min-h-11 bg-[#f2eddf]"} value={module} disabled={loading || !!end}
          onChange={event => {
            setModule(event.target.value); setPaperId(""); setSession([]); setIndex(0); setNotice("");
          }}>
          <option value="">Choose a module</option>
          {modules.map(code => <option key={code}>{code}</option>)}
        </select>
      </label>
      {module && <label className="grid gap-1.5 text-sm font-medium">Past paper
        <select className={button + " min-h-11 bg-[#f2eddf]"} value={paperId} disabled={loading || !!end}
          onChange={event => { setPaperId(event.target.value); setNotice(""); }}>
          <option value="">Choose a paper</option>
          {modulePapers.map(p => <option key={p.id} value={p.id}>{p.year} · {p.exam}</option>)}
        </select>
      </label>}
      {module && <button type="button" disabled={!paperId || loading || !!end}
        className="min-h-11 justify-self-start rounded-md bg-[#315a45] px-4 text-sm font-semibold text-white disabled:bg-[#d8d9cb] disabled:text-[#47554b]"
        onClick={startPaper}>{loading ? "Loading questions…" : "Practise this paper"}</button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {question && <article className="space-y-4 rounded-lg border border-[#cbc5b4] bg-[#f2eddf] p-5">
      <p className="text-sm">Question {index + 1} of {session.length} · {question.module} · {question.year} {question.exam}</p>
      <h2 className="text-xl font-semibold">Q{question.question_number}</h2>
      <p className="whitespace-pre-line leading-7">{question.text}</p>
      <a className="block underline" href={url(question.paper_id, question.page_number)} target="_blank" rel="noreferrer">View original question in PDF</a>
      <div className="flex flex-wrap gap-2">{(["Got it","Needs work","Retry later"] as const).map(label =>
        <button key={label} className={button} onClick={() => rate(label)}>{label}</button>)}</div>
    </article>}
    {module && <section><h2 className="text-xl font-semibold">Revision queue <span className="text-base font-normal text-[#47554b]">· {queue.length} saved</span></h2>
      {queue.length === 0 && <p className="mt-2 text-sm">Questions you mark “Needs work” or “Retry later” in {module} will appear here.</p>}
      {[...new Set(queue.map(entry => entry.question.module))].sort().map(module =>
        <div key={module} className="mt-3"><h3 className="font-semibold">{module}</h3>
          {[...new Set(queue.filter(entry => entry.question.module === module).map(entry => entry.question.topic))].map(topic => {
            const items = queue.filter(entry => entry.question.module === module && entry.question.topic === topic);
            return <button className={button + " mr-2 mt-2"} key={topic} onClick={() => {
              setSession(items.map(entry => entry.question)); setIndex(0); setNotice("");
            }}>{topic} · {items.length}</button>;
          })}
        </div>)}
    </section>}
    {module && <section className="rounded-lg border border-[#cbc5b4] bg-[#f2eddf] p-5"><h2 className="text-xl font-semibold">Timed mock</h2>
      <p className="mt-1 text-sm text-[#47554b]">{paperId ? "Use the selected paper for a timed attempt." : "Choose a past paper above to start a timed mock."}</p>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault(); const time = Date.now(); setNow(time); setEnd(time + Number(minutes) * 60000); setNotice("");
      }}>
        <label className="grid gap-1 text-sm">Minutes<input className={button + " w-24"} required disabled={!!end} type="number" min="1" max="600" value={minutes} onChange={event => setMinutes(event.target.value)}/></label>
        {!end && <button disabled={!paperId || loading} className={button + " disabled:opacity-50"}>Start timer</button>}
      </form>
      {!!end && <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="font-semibold tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        <a className="underline" target="_blank" rel="noreferrer" href={url(paperId)}>Open exam PDF</a>
        <button className={button} onClick={() => setEnd(0)}>Finish mock</button>
      </div>}
    </section>}
  </section>;
}
