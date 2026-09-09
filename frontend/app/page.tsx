"use client";

import { useEffect, useMemo, useState } from "react";

type Paper = {
  id: string;
  module: string;
  year: number;
  exam: string;
  original_filename: string;
};

type SearchResult = {
  id: string;
  paper_id: string;
  module: string;
  year: number;
  exam: string;
  question_number: string;
  page_number: number | null;
  text: string;
  score: number;
};

export default function Home() {
  // -------------------------
  // Upload state
  // -------------------------

  const [module, setModule] = useState("");
  const [year, setYear] = useState("");
  const [exam, setExam] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  // -------------------------
  // Library state
  // -------------------------

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);

  const [
    deletingPaperId,
    setDeletingPaperId
  ] = useState<string | null>(null);

  // -------------------------
  // Search state
  // -------------------------

  const [
    selectedModule,
    setSelectedModule
  ] = useState("");

  const [
    selectedYear,
    setSelectedYear
  ] = useState("");

  const [
    selectedExam,
    setSelectedExam
  ] = useState("");

  const [
    searchQuery,
    setSearchQuery
  ] = useState("");

  const [
    searching,
    setSearching
  ] = useState(false);

  const [
    searchResults,
    setSearchResults
  ] = useState<SearchResult[]>([]);

  const [
    searchMessage,
    setSearchMessage
  ] = useState("");

  // -------------------------
  // API
  // -------------------------

  const API =
    "http://127.0.0.1:8000";

  // -------------------------
  // Filter options
  // -------------------------

  const availableModules =
    useMemo(() => {

      return Array.from(
        new Set(
          papers.map(
            (paper) =>
              paper.module
          )
        )
      ).sort();

    }, [papers]);


  const availableYears =
    useMemo(() => {

      return Array.from(
        new Set(
          papers
            .filter(
              (paper) =>
                !selectedModule ||
                paper.module ===
                  selectedModule
            )
            .map(
              (paper) =>
                paper.year
            )
        )
      ).sort(
        (a, b) =>
          b - a
      );

    }, [
      papers,
      selectedModule
    ]);


  const availableExams =
    useMemo(() => {

      return Array.from(
        new Set(
          papers
            .filter(
              (paper) =>
                (
                  !selectedModule ||
                  paper.module ===
                    selectedModule
                ) &&
                (
                  !selectedYear ||
                  paper.year ===
                    Number(
                      selectedYear
                    )
                )
            )
            .map(
              (paper) =>
                paper.exam
            )
        )
      ).sort();

    }, [
      papers,
      selectedModule,
      selectedYear
    ]);


  // -------------------------
  // Load papers
  // -------------------------

  async function loadPapers() {
    try {

      setLoadingPapers(
        true
      );

      const response =
        await fetch(
          `${API}/papers`
        );

      if (!response.ok) {
        throw new Error(
          "Could not load papers"
        );
      }

      const data =
        await response.json();

      setPapers(
        data
      );

    } catch (error) {

      console.error(
        error
      );

    } finally {

      setLoadingPapers(
        false
      );
    }
  }


  useEffect(() => {
    loadPapers();
  }, []);


  useEffect(() => {

    if (
      selectedModule &&
      !availableModules.includes(
        selectedModule
      )
    ) {

      setSelectedModule(
        ""
      );

      setSelectedYear(
        ""
      );

      setSelectedExam(
        ""
      );

      setSearchResults(
        []
      );

      setSearchMessage(
        ""
      );
    }

  }, [
    availableModules,
    selectedModule
  ]);


  // -------------------------
  // Upload
  // -------------------------

  async function handleUpload() {

    if (
      !file ||
      !module ||
      !year ||
      !exam
    ) {

      setMessage(
        "Please complete all fields."
      );

      return;
    }


    const formData =
      new FormData();


    formData.append(
      "module",
      module
    );

    formData.append(
      "year",
      year
    );

    formData.append(
      "exam",
      exam
    );

    formData.append(
      "file",
      file
    );


    try {

      setUploading(
        true
      );

      setMessage(
        ""
      );


      const response =
        await fetch(
          `${API}/papers`,
          {
            method:
              "POST",

            body:
              formData,
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Upload failed"
        );
      }


      setMessage(
        `Uploaded successfully. Found ${data.main_questions_found} main questions and ${data.sub_questions_found} sub-questions.`
      );


      setFile(
        null
      );

      setModule(
        ""
      );

      setYear(
        ""
      );

      setExam(
        ""
      );


      await loadPapers();


    } catch (error) {

      if (
        error instanceof Error
      ) {

        setMessage(
          error.message
        );

      } else {

        setMessage(
          "Something went wrong."
        );
      }

    } finally {

      setUploading(
        false
      );
    }
  }


  // -------------------------
  // Delete
  // -------------------------

  async function handleDeletePaper(
    paperId: string
  ) {

    const confirmed =
      window.confirm(
        "Delete this paper and all of its parsed questions?"
      );


    if (!confirmed) {
      return;
    }


    try {

      setDeletingPaperId(
        paperId
      );


      const response =
        await fetch(
          `${API}/papers/${paperId}`,
          {
            method:
              "DELETE",
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Delete failed"
        );
      }


      setPapers(
        (
          currentPapers
        ) =>
          currentPapers.filter(
            (paper) =>
              paper.id !==
              paperId
          )
      );


      setSearchResults(
        []
      );

      setSearchMessage(
        ""
      );


    } catch (error) {

      if (
        error instanceof Error
      ) {

        alert(
          error.message
        );

      } else {

        alert(
          "Something went wrong."
        );
      }

    } finally {

      setDeletingPaperId(
        null
      );
    }
  }


  // -------------------------
  // Search
  // -------------------------

  async function handleSearch() {

    if (!selectedModule) {

      setSearchMessage(
        "Select a module first."
      );

      return;
    }


    if (
      !searchQuery.trim()
    ) {

      setSearchMessage(
        "Paste a question first."
      );

      return;
    }


    try {

      setSearching(
        true
      );

      setSearchMessage(
        ""
      );

      setSearchResults(
        []
      );


      const response =
        await fetch(
          `${API}/search`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  query:
                    searchQuery,

                  module:
                    selectedModule,

                  year:
                    selectedYear
                      ? Number(
                          selectedYear
                        )
                      : null,

                  exam:
                    selectedExam ||
                    null,

                  limit:
                    10,

                  min_score:
                    0.35,
                }
              ),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Search failed"
        );
      }


      setSearchResults(
        data
      );


      if (
        data.length === 0
      ) {

        setSearchMessage(
          "No sufficiently similar questions found for these filters."
        );
      }


    } catch (error) {

      if (
        error instanceof Error
      ) {

        setSearchMessage(
          error.message
        );

      } else {

        setSearchMessage(
          "Something went wrong."
        );
      }

    } finally {

      setSearching(
        false
      );
    }
  }


  // -------------------------
  // PDF URL helper
  // -------------------------

  function getPaperUrl(
    paperId: string,
    pageNumber?: number | null
  ) {

    const baseUrl =
      `${API}/papers/${paperId}/file`;

    if (!pageNumber) {
      return baseUrl;
    }

    return (
      `${baseUrl}#page=${pageNumber}`
    );
  }


  // -------------------------
  // UI
  // -------------------------

  return (

    <main className="min-h-screen bg-zinc-950 text-white">

      <div className="mx-auto max-w-5xl px-6 py-20">


        {/* HEADER */}

        <div className="mb-16">

          <p className="mb-3 text-sm font-medium text-zinc-500">
            EXAM SEARCH
          </p>

          <h1 className="text-5xl font-semibold tracking-tight">
            Find similar past-paper questions.
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-zinc-400">
            Select a module, paste a question,
            and find semantically similar
            questions from previous exams.
          </p>

        </div>


        {/* SEARCH */}

        <section className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

          <p className="mb-2 text-sm font-medium text-zinc-500">
            SEMANTIC SEARCH
          </p>

          <h2 className="text-2xl font-semibold">
            Search past-paper questions
          </h2>


          {/* MODULE */}

          <div className="mt-6">

            <label className="mb-2 block text-sm text-zinc-400">
              Module
            </label>

            <select
              value={
                selectedModule
              }
              onChange={(
                event
              ) => {

                setSelectedModule(
                  event.target.value
                );

                setSelectedYear(
                  ""
                );

                setSelectedExam(
                  ""
                );

                setSearchResults(
                  []
                );

                setSearchMessage(
                  ""
                );
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
            >

              <option value="">
                Select a module
              </option>

              {availableModules.map(
                (
                  moduleName
                ) => (

                  <option
                    key={
                      moduleName
                    }
                    value={
                      moduleName
                    }
                  >
                    {moduleName}
                  </option>

                )
              )}

            </select>

          </div>


          {/* YEAR + EXAM */}

          <div className="mt-4 grid gap-4 md:grid-cols-2">


            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Year
              </label>

              <select
                value={
                  selectedYear
                }
                onChange={(
                  event
                ) => {

                  setSelectedYear(
                    event.target.value
                  );

                  setSelectedExam(
                    ""
                  );

                  setSearchResults(
                    []
                  );

                  setSearchMessage(
                    ""
                  );
                }}
                disabled={
                  !selectedModule
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:opacity-40"
              >

                <option value="">
                  All years
                </option>

                {availableYears.map(
                  (
                    yearValue
                  ) => (

                    <option
                      key={
                        yearValue
                      }
                      value={
                        yearValue
                      }
                    >
                      {yearValue}
                    </option>

                  )
                )}

              </select>

            </div>


            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Exam
              </label>

              <select
                value={
                  selectedExam
                }
                onChange={(
                  event
                ) => {

                  setSelectedExam(
                    event.target.value
                  );

                  setSearchResults(
                    []
                  );

                  setSearchMessage(
                    ""
                  );
                }}
                disabled={
                  !selectedModule
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:opacity-40"
              >

                <option value="">
                  All exams
                </option>

                {availableExams.map(
                  (
                    examName
                  ) => (

                    <option
                      key={
                        examName
                      }
                      value={
                        examName
                      }
                    >
                      {examName}
                    </option>

                  )
                )}

              </select>

            </div>

          </div>


          {/* QUERY */}

          <textarea
            value={
              searchQuery
            }
            onChange={(
              event
            ) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder="e.g. How do regular expressions help with tokenization?"
            className="mt-6 h-36 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-white outline-none focus:border-zinc-500"
          />


          <button
            onClick={
              handleSearch
            }
            disabled={
              searching ||
              !searchQuery.trim() ||
              !selectedModule
            }
            className="mt-4 rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >

            {searching
              ? "Searching..."
              : "Find similar questions"}

          </button>


          {searchMessage && (

            <p className="mt-4 text-sm text-zinc-400">
              {searchMessage}
            </p>

          )}


          {/* RESULTS */}

          {searchResults.length > 0 && (

            <div className="mt-8 space-y-4">


              {searchResults.map(
                (
                  result,
                  index
                ) => {

                  const similarity =
                    Math.round(
                      result.score *
                      100
                    );


                  return (

                    <article
                      key={
                        result.id
                      }
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-6"
                    >


                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          #{index + 1}
                        </span>

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {similarity}% similarity
                        </span>

                        {result.page_number && (

                          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                            Page {result.page_number}
                          </span>

                        )}

                      </div>


                      <h3 className="mt-4 text-lg font-semibold">

                        {result.module} ·{" "}
                        {result.year} ·{" "}
                        {result.exam}

                      </h3>


                      <p className="mt-1 text-sm text-zinc-400">

                        Question{" "}
                        {result.question_number}

                      </p>


                      <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">

                        {result.text}

                      </p>


                      <div className="mt-6">

                        <a
                          href={
                            getPaperUrl(
                              result.paper_id,
                              result.page_number
                            )
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                        >

                          Open source paper

                        </a>

                      </div>


                    </article>

                  );
                }
              )}


            </div>

          )}


        </section>


        {/* UPLOAD */}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

          <p className="mb-2 text-sm font-medium text-zinc-500">
            PAPER LIBRARY
          </p>

          <h2 className="mb-6 text-2xl font-semibold">
            Upload past paper
          </h2>


          <div className="mb-6">

            <label className="mb-2 block text-sm text-zinc-400">
              Module
            </label>

            <input
              type="text"
              value={
                module
              }
              onChange={(
                event
              ) =>
                setModule(
                  event.target.value
                )
              }
              placeholder="e.g. CS404"
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
                value={
                  year
                }
                onChange={(
                  event
                ) =>
                  setYear(
                    event.target.value
                  )
                }
                placeholder="2023"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm text-zinc-400">
                Exam
              </label>

              <input
                type="text"
                value={
                  exam
                }
                onChange={(
                  event
                ) =>
                  setExam(
                    event.target.value
                  )
                }
                placeholder="January"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-500"
              />

            </div>


          </div>


          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 px-6 py-14 transition hover:border-zinc-500 hover:bg-zinc-800/50">

            <span className="text-lg font-medium">

              {file
                ? file.name
                : "Choose a PDF"}

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
              onChange={(
                event
              ) => {

                const selectedFile =
                  event.target
                    .files?.[0];


                if (
                  selectedFile
                ) {

                  setFile(
                    selectedFile
                  );
                }
              }}
            />

          </label>


          <button
            onClick={
              handleUpload
            }
            disabled={
              !file ||
              uploading
            }
            className="mt-6 w-full rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >

            {uploading
              ? "Uploading..."
              : "Upload paper"}

          </button>


          {message && (

            <p className="mt-4 text-sm text-zinc-400">
              {message}
            </p>

          )}


        </section>


        {/* LIBRARY */}

        <section className="mt-16">


          <div className="mb-6 flex items-end justify-between">


            <div>

              <p className="mb-2 text-sm font-medium text-zinc-500">
                LIBRARY
              </p>

              <h2 className="text-2xl font-semibold">
                Past papers
              </h2>

            </div>


            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-400">

              {papers.length}{" "}

              {papers.length === 1
                ? "paper"
                : "papers"}

            </span>


          </div>


          {loadingPapers ? (

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
              Loading papers...
            </div>

          ) : papers.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-12 text-center">

              <p className="font-medium text-zinc-300">
                No papers uploaded yet.
              </p>

            </div>

          ) : (

            <div className="space-y-3">


              {papers.map(
                (
                  paper
                ) => (

                  <div
                    key={
                      paper.id
                    }
                    className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5 md:flex-row md:items-center"
                  >


                    <div>

                      <h3 className="font-medium">
                        {paper.module}
                      </h3>

                      <p className="mt-1 text-sm text-zinc-400">

                        {paper.year} ·{" "}
                        {paper.exam}

                      </p>

                      <p className="mt-2 text-xs text-zinc-600">
                        {paper.original_filename}
                      </p>

                    </div>


                    <div className="flex items-center gap-3">


                      <a
                        href={
                          getPaperUrl(
                            paper.id
                          )
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
                      >
                        Open PDF
                      </a>


                      <button
                        onClick={() =>
                          handleDeletePaper(
                            paper.id
                          )
                        }
                        disabled={
                          deletingPaperId ===
                          paper.id
                        }
                        className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >

                        {deletingPaperId ===
                        paper.id
                          ? "Deleting..."
                          : "Delete"}

                      </button>


                    </div>


                  </div>

                )
              )}


            </div>

          )}


        </section>


      </div>

    </main>
  );
}