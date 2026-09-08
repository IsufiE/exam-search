"use client";

import { useState } from "react";

export default function Home() {
  const [module, setModule] = useState("");
  const [year, setYear] = useState("");
  const [exam, setExam] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload() {
    if (!file || !module || !year || !exam) {
      setMessage("Please complete all fields.");
      return;
    }

    const formData = new FormData();

    formData.append("module", module);
    formData.append("year", year);
    formData.append("exam", exam);
    formData.append("file", file);

    try {
      setUploading(true);
      setMessage("");

      const response = await fetch(
        "http://127.0.0.1:8000/papers",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setMessage("Paper uploaded successfully.");
      setFile(null);
      setModule("");
      setYear("");
      setExam("");

    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Something went wrong.");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-20">

        <div className="mb-16">
          <p className="mb-3 text-sm font-medium text-zinc-500">
            EXAM SEARCH
          </p>

          <h1 className="text-5xl font-semibold tracking-tight">
            Build your past-paper library.
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-zinc-400">
            Upload past exam papers now. Later, you&apos;ll be able to paste
            any question and instantly find similar questions from previous
            exams.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

          <h2 className="mb-6 text-xl font-medium">
            Upload past paper
          </h2>

          <div className="mb-6">
            <label className="mb-2 block text-sm text-zinc-400">
              Module
            </label>

            <input
              type="text"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="e.g. Statistics"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Year
              </label>

              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Exam
              </label>

              <input
                type="text"
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                placeholder="Final Exam"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-500"
              />
            </div>

          </div>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 px-6 py-14 transition hover:border-zinc-500 hover:bg-zinc-800/50">

            <span className="text-lg font-medium">
              {file ? file.name : "Choose a PDF"}
            </span>

            <span className="mt-2 text-sm text-zinc-500">
              {file
                ? "Ready to upload"
                : "Click here to select a past paper"}
            </span>

            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(event) => {
                const selectedFile =
                  event.target.files?.[0];

                if (selectedFile) {
                  setFile(selectedFile);
                }
              }}
            />

          </label>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-6 w-full rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload paper"}
          </button>

          {message && (
            <p className="mt-4 text-sm text-zinc-400">
              {message}
            </p>
          )}

        </div>

      </div>
    </main>
  );
}