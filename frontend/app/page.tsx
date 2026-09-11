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

type TrendQuestion = {
  id: string;
  paper_id: string;
  year: number;
  exam: string;
  question_number: string;
  page_number: number | null;
  text: string;
};

type TrendTopic = {
  id: string;
  topic: string;
  question_count: number;
  appearance_count: number;
  years: number[];
  cohesion: number;
  questions: TrendQuestion[];
};

type TrendResponse = {
  module: string;
  papers_years: number[];
  years_analysed: number;
  questions_analysed: number;
  topic_count: number;
  similarity_threshold: number;
  minimum_years: number;
  topics: TrendTopic[];
};

type SimilarQuestion = {
  id: string;
  paper_id: string;
  module: string;
  year: number;
  exam: string;
  question_number: string;
  page_number: number | null;
  text: string;
};

type SimilarQuestionMatch = {
  id: string;
  similarity: number;
  question: SimilarQuestion;
  similar_question: SimilarQuestion;
};

type SimilarQuestionsResponse = {
  module: string;
  years: number[];
  questions_analysed: number;
  comparisons: number;
  similarity_threshold: number;
  different_years_only: boolean;
  match_count: number;
  matches: SimilarQuestionMatch[];
};

type MainView = "search" | "trends";

type SelectedMatrixCell = {
  topicId: string;
  year: number;
} | null;

export default function Home() {
  // =========================================================
  // Upload state
  // =========================================================

  const [module, setModule] = useState("");
  const [year, setYear] = useState("");
  const [exam, setExam] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  // =========================================================
  // Library state
  // =========================================================

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);

  const [deletingPaperId, setDeletingPaperId] =
    useState<string | null>(null);

  const [openModules, setOpenModules] = useState<string[]>([]);

  // =========================================================
  // Main view
  // =========================================================

  const [mainView, setMainView] =
    useState<MainView>("search");

  // =========================================================
  // Search state
  // =========================================================

  const [selectedModule, setSelectedModule] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const [searchResults, setSearchResults] =
    useState<SearchResult[]>([]);

  const [searchMessage, setSearchMessage] = useState("");

  // =========================================================
  // Trends state
  // =========================================================

  const [trendModule, setTrendModule] = useState("");

  const [trendData, setTrendData] =
    useState<TrendResponse | null>(null);

  const [loadingTrends, setLoadingTrends] = useState(false);

  const [trendMessage, setTrendMessage] = useState("");

  const [openTopics, setOpenTopics] = useState<string[]>([]);

  const [
    selectedMatrixCell,
    setSelectedMatrixCell,
  ] = useState<SelectedMatrixCell>(null);

  // =========================================================
  // Similar-question state
  // =========================================================

  const [
    similarQuestionsData,
    setSimilarQuestionsData,
  ] = useState<SimilarQuestionsResponse | null>(null);

  const [
    similarQuestionsMessage,
    setSimilarQuestionsMessage,
  ] = useState("");

  // =========================================================
  // API
  // =========================================================

  const API = "http://127.0.0.1:8000";

  // =========================================================
  // Filter options
  // =========================================================

  const availableModules = useMemo(() => {
    return Array.from(
      new Set(
        papers.map((paper) => paper.module)
      )
    ).sort();
  }, [papers]);

  const availableYears = useMemo(() => {
    return Array.from(
      new Set(
        papers
          .filter(
            (paper) =>
              !selectedModule ||
              paper.module === selectedModule
          )
          .map((paper) => paper.year)
      )
    ).sort((a, b) => b - a);
  }, [papers, selectedModule]);

  const availableExams = useMemo(() => {
    return Array.from(
      new Set(
        papers
          .filter(
            (paper) =>
              (
                !selectedModule ||
                paper.module === selectedModule
              ) &&
              (
                !selectedYear ||
                paper.year === Number(selectedYear)
              )
          )
          .map((paper) => paper.exam)
      )
    ).sort();
  }, [
    papers,
    selectedModule,
    selectedYear,
  ]);

  // =========================================================
  // Grouped library
  // =========================================================

  const groupedPapers = useMemo(() => {
    const groups: Record<string, Paper[]> = {};

    for (const paper of papers) {
      if (!groups[paper.module]) {
        groups[paper.module] = [];
      }

      groups[paper.module].push(paper);
    }

    for (const moduleName of Object.keys(groups)) {
      groups[moduleName].sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year;
        }

        return a.exam.localeCompare(b.exam);
      });
    }

    return groups;
  }, [papers]);

  // =========================================================
  // Selected matrix data
  // =========================================================

  const selectedMatrixTopic = useMemo(() => {
    if (
      !trendData ||
      !selectedMatrixCell
    ) {
      return null;
    }

    return (
      trendData.topics.find(
        (topic) =>
          topic.id === selectedMatrixCell.topicId
      ) || null
    );
  }, [
    trendData,
    selectedMatrixCell,
  ]);

  const selectedMatrixQuestions = useMemo(() => {
    if (
      !selectedMatrixTopic ||
      !selectedMatrixCell
    ) {
      return [];
    }

    return selectedMatrixTopic.questions.filter(
      (question) =>
        question.year === selectedMatrixCell.year
    );
  }, [
    selectedMatrixTopic,
    selectedMatrixCell,
  ]);

  // =========================================================
  // Load papers
  // =========================================================

  async function loadPapers() {
    try {
      setLoadingPapers(true);

      const response = await fetch(
        `${API}/papers`
      );

      if (!response.ok) {
        throw new Error(
          "Could not load papers"
        );
      }

      const data = await response.json();

      setPapers(data);

    } catch (error) {

      console.error(error);

    } finally {

      setLoadingPapers(false);

    }
  }

  useEffect(() => {
    loadPapers();
  }, []);

  // =========================================================
  // Keep selected modules valid
  // =========================================================

  useEffect(() => {
    if (
      selectedModule &&
      !availableModules.includes(selectedModule)
    ) {
      setSelectedModule("");
      setSelectedYear("");
      setSelectedExam("");
      setSearchResults([]);
      setSearchMessage("");
    }

    if (
      trendModule &&
      !availableModules.includes(trendModule)
    ) {
      setTrendModule("");
      setTrendData(null);
      setTrendMessage("");
      setOpenTopics([]);
      setSelectedMatrixCell(null);

      setSimilarQuestionsData(null);
      setSimilarQuestionsMessage("");
    }
  }, [
    availableModules,
    selectedModule,
    trendModule,
  ]);

  // =========================================================
  // Module accordion
  // =========================================================

  function toggleModule(moduleName: string) {
    setOpenModules((current) => {
      if (current.includes(moduleName)) {
        return current.filter(
          (item) => item !== moduleName
        );
      }

      return [
        ...current,
        moduleName,
      ];
    });
  }

  // =========================================================
  // Topic accordion
  // =========================================================

  function toggleTopic(topicId: string) {
    setOpenTopics((current) => {
      if (current.includes(topicId)) {
        return current.filter(
          (item) => item !== topicId
        );
      }

      return [
        ...current,
        topicId,
      ];
    });
  }

  // =========================================================
  // Trend helpers
  // =========================================================

  function getTopicYearCount(
    topic: TrendTopic,
    targetYear: number
  ) {
    return topic.questions.filter(
      (question) =>
        question.year === targetYear
    ).length;
  }

  function getTopicMaximumYearCount(
    topic: TrendTopic
  ) {
    if (!trendData) {
      return 1;
    }

    const counts =
      trendData.papers_years.map(
        (yearValue) =>
          getTopicYearCount(
            topic,
            yearValue
          )
      );

    return Math.max(
      1,
      ...counts
    );
  }

  function handleMatrixCellClick(
    topic: TrendTopic,
    targetYear: number
  ) {
    const count = getTopicYearCount(
      topic,
      targetYear
    );

    if (count === 0) {
      return;
    }

    if (
      selectedMatrixCell?.topicId === topic.id &&
      selectedMatrixCell.year === targetYear
    ) {
      setSelectedMatrixCell(null);
      return;
    }

    setSelectedMatrixCell({
      topicId: topic.id,
      year: targetYear,
    });
  }

  // =========================================================
  // Upload
  // =========================================================

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

    const formData = new FormData();

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
      setUploading(true);
      setMessage("");

      const response = await fetch(
        `${API}/papers`,
        {
          method: "POST",
          body: formData,
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

      setFile(null);
      setModule("");
      setYear("");
      setExam("");

      setTrendData(null);
      setOpenTopics([]);
      setSelectedMatrixCell(null);

      setSimilarQuestionsData(null);
      setSimilarQuestionsMessage("");

      await loadPapers();

    } catch (error) {

      if (error instanceof Error) {
        setMessage(
          error.message
        );
      } else {
        setMessage(
          "Something went wrong."
        );
      }

    } finally {

      setUploading(false);

    }
  }

  // =========================================================
  // Delete
  // =========================================================

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

      const response = await fetch(
        `${API}/papers/${paperId}`,
        {
          method: "DELETE",
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
        (currentPapers) =>
          currentPapers.filter(
            (paper) =>
              paper.id !== paperId
          )
      );

      setSearchResults([]);
      setSearchMessage("");

      setTrendData(null);
      setTrendMessage("");
      setOpenTopics([]);
      setSelectedMatrixCell(null);

      setSimilarQuestionsData(null);
      setSimilarQuestionsMessage("");

    } catch (error) {

      if (error instanceof Error) {
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

  // =========================================================
  // Search
  // =========================================================

  async function handleSearch() {
    if (!selectedModule) {
      setSearchMessage(
        "Select a module first."
      );

      return;
    }

    if (!searchQuery.trim()) {
      setSearchMessage(
        "Paste a question first."
      );

      return;
    }

    try {
      setSearching(true);

      setSearchMessage("");
      setSearchResults([]);

      const response = await fetch(
        `${API}/search`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            query:
              searchQuery,

            module:
              selectedModule,

            year:
              selectedYear
                ? Number(selectedYear)
                : null,

            exam:
              selectedExam ||
              null,

            limit:
              10,

            min_score:
              0.35,
          }),
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

      if (data.length === 0) {
        setSearchMessage(
          "No sufficiently relevant questions found for these filters."
        );
      }

    } catch (error) {

      if (error instanceof Error) {
        setSearchMessage(
          error.message
        );
      } else {
        setSearchMessage(
          "Something went wrong."
        );
      }

    } finally {

      setSearching(false);

    }
  }

  // =========================================================
  // Trends
  // =========================================================

  async function handleLoadTrends() {
    if (!trendModule) {
      setTrendMessage(
        "Select a module first."
      );

      return;
    }

    try {
      setLoadingTrends(true);

      setTrendMessage("");
      setTrendData(null);
      setOpenTopics([]);
      setSelectedMatrixCell(null);

      setSimilarQuestionsData(null);
      setSimilarQuestionsMessage("");

      const [
        trendsResponse,
        similarResponse,
      ] = await Promise.all([
        fetch(
          `${API}/trends/${encodeURIComponent(
            trendModule
          )}`
        ),

        fetch(
          `${API}/repeated-questions/${encodeURIComponent(
            trendModule
          )}`
        ),
      ]);

      const trendsData =
        await trendsResponse.json();

      if (!trendsResponse.ok) {
        throw new Error(
          trendsData.detail ||
          "Could not analyse trends"
        );
      }

      setTrendData(
        trendsData
      );

      if (
        !trendsData.topics ||
        trendsData.topics.length === 0
      ) {
        setTrendMessage(
          "No recurring topics were found across multiple years for this module."
        );
      }

      const similarData =
        await similarResponse.json();

      if (similarResponse.ok) {

        setSimilarQuestionsData(
          similarData
        );

        if (
          !similarData.matches ||
          similarData.matches.length === 0
        ) {
          setSimilarQuestionsMessage(
            "No strongly similar questions were found across different exam years."
          );
        }

      } else {

        setSimilarQuestionsMessage(
          similarData.detail ||
          "Could not analyse similar past questions."
        );

      }

    } catch (error) {

      if (error instanceof Error) {
        setTrendMessage(
          error.message
        );
      } else {
        setTrendMessage(
          "Something went wrong."
        );
      }

    } finally {

      setLoadingTrends(false);

    }
  }

  // =========================================================
  // PDF helper
  // =========================================================

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

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      <div className="mx-auto max-w-5xl px-6 py-20">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-12">

          <p className="mb-3 text-sm font-medium tracking-wide text-zinc-500">
            EXAM SEARCH
          </p>

          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight">
            Search past papers and discover recurring exam topics.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-400">
            Search semantically similar questions across previous
            exams or analyse which topics repeatedly appear across
            different years.
          </p>

        </div>

        {/* =====================================================
            SEARCH / TRENDS NAVIGATION
        ===================================================== */}

        <div className="mb-6 inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">

          <button
            onClick={() =>
              setMainView(
                "search"
              )
            }
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              mainView === "search"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Search
          </button>

          <button
            onClick={() =>
              setMainView(
                "trends"
              )
            }
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
              mainView === "trends"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Trends
          </button>

        </div>

        {/* =====================================================
            SEARCH
        ===================================================== */}

        {mainView === "search" && (

          <section className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

            <p className="mb-2 text-sm font-medium text-zinc-500">
              SEMANTIC SEARCH
            </p>

            <h2 className="text-2xl font-semibold">
              Search past-paper questions
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Search combines semantic retrieval with keyword
              matching to rank relevant past-paper questions.
            </p>

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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-500"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-500 disabled:opacity-40"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-500 disabled:opacity-40"
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
              placeholder="e.g. How does a protocol determine message boundaries while managing persistent connections?"
              className="mt-6 h-36 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-4 leading-7 text-white outline-none transition focus:border-zinc-500"
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

            {searchResults.length > 0 && (

              <div className="mt-8">

                <div className="mb-4 flex items-center justify-between">

                  <p className="text-sm text-zinc-500">
                    {searchResults.length}{" "}
                    {searchResults.length === 1
                      ? "result"
                      : "results"}
                  </p>

                </div>

                <div className="space-y-4">

                  {searchResults.map(
                    (
                      result,
                      index
                    ) => {

                      const relevance =
                        Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              result.score *
                              100
                            )
                          )
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
                              {relevance}% relevance
                            </span>

                            {result.page_number && (

                              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                                Page{" "}
                                {result.page_number}
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

              </div>

            )}

          </section>

        )}

        {/* =====================================================
            TRENDS
        ===================================================== */}

        {mainView === "trends" && (

          <section className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

            <p className="mb-2 text-sm font-medium text-zinc-500">
              EXAM TRENDS
            </p>

            <h2 className="text-2xl font-semibold">
              Recurring topics
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              Analyse recurring topics and identify strongly similar
              questions that appear across different exam years.
            </p>

            <div className="mt-6">

              <label className="mb-2 block text-sm text-zinc-400">
                Module
              </label>

              <select
                value={
                  trendModule
                }
                onChange={(
                  event
                ) => {

                  setTrendModule(
                    event.target.value
                  );

                  setTrendData(
                    null
                  );

                  setTrendMessage(
                    ""
                  );

                  setOpenTopics(
                    []
                  );

                  setSelectedMatrixCell(
                    null
                  );

                  setSimilarQuestionsData(
                    null
                  );

                  setSimilarQuestionsMessage(
                    ""
                  );
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-500"
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

            <button
              onClick={
                handleLoadTrends
              }
              disabled={
                loadingTrends ||
                !trendModule
              }
              className="mt-4 rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingTrends
                ? "Analysing..."
                : "Analyse trends"}
            </button>

            {trendMessage && (

              <p className="mt-4 text-sm text-zinc-400">
                {trendMessage}
              </p>

            )}

            {trendData && (

              <div className="mt-8">

                {/* =================================================
                    SUMMARY
                ================================================= */}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">

                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Module
                    </p>

                    <p className="mt-2 text-xl font-semibold">
                      {trendData.module}
                    </p>

                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">

                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Years analysed
                    </p>

                    <p className="mt-2 text-xl font-semibold">
                      {trendData.years_analysed}
                    </p>

                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">

                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Questions
                    </p>

                    <p className="mt-2 text-xl font-semibold">
                      {trendData.questions_analysed}
                    </p>

                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">

                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Recurring topics
                    </p>

                    <p className="mt-2 text-xl font-semibold">
                      {trendData.topic_count}
                    </p>

                  </div>

                </div>

                {/* =================================================
                    YEAR BADGES
                ================================================= */}

                {trendData.papers_years.length > 0 && (

                  <div className="mt-6 flex flex-wrap items-center gap-2">

                    <span className="mr-2 text-sm text-zinc-500">
                      Exam years
                    </span>

                    {trendData.papers_years.map(
                      (
                        yearValue
                      ) => (

                        <span
                          key={
                            yearValue
                          }
                          className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300"
                        >
                          {yearValue}
                        </span>

                      )
                    )}

                  </div>

                )}

                {/* =================================================
                    SIMILAR PAST QUESTIONS
                ================================================= */}

                <div className="mt-10">

                  <div className="mb-5">

                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

                      <div>

                        <p className="text-sm font-medium text-zinc-500">
                          SIMILAR PAST QUESTIONS
                        </p>

                        <h3 className="mt-2 text-xl font-semibold">
                          Possible repeated or reworded questions
                        </h3>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                          Strong semantic matches found between questions
                          from different exam years. These indicate similar
                          question patterns, not necessarily exact repeats.
                        </p>

                      </div>

                      {similarQuestionsData && (

                        <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400">
                          {similarQuestionsData.match_count}{" "}
                          {similarQuestionsData.match_count === 1
                            ? "match"
                            : "matches"}
                        </span>

                      )}

                    </div>

                  </div>

                  {similarQuestionsMessage && (

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">

                      <p className="text-sm text-zinc-400">
                        {similarQuestionsMessage}
                      </p>

                    </div>

                  )}

                  {similarQuestionsData &&
                   similarQuestionsData.matches.length > 0 && (

                    <div className="space-y-5">

                      {similarQuestionsData.matches.map(
                        (
                          match,
                          index
                        ) => {

                          const similarityPercent =
                            Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(
                                  match.similarity *
                                  100
                                )
                              )
                            );

                          return (

                            <article
                              key={
                                match.id
                              }
                              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                            >

                              {/* Match heading */}

                              <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 bg-zinc-900/60 px-6 py-5 sm:flex-row sm:items-center">

                                <div>

                                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Match {index + 1}
                                  </p>

                                  <p className="mt-1 text-sm text-zinc-400">
                                    Questions from different exam years
                                  </p>

                                </div>

                                <div className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2">

                                  <span className="text-sm font-semibold text-zinc-200">
                                    {similarityPercent}%
                                  </span>

                                  <span className="ml-1 text-xs text-zinc-500">
                                    similar
                                  </span>

                                </div>

                              </div>

                              {/* Pair */}

                              <div className="grid md:grid-cols-2">

                                {/* Newer / first question */}

                                <div className="border-b border-zinc-800 p-6 md:border-b-0 md:border-r">

                                  <div className="flex flex-wrap items-center gap-2">

                                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                      {match.question.year}
                                    </span>

                                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                      {match.question.exam}
                                    </span>

                                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                      Question{" "}
                                      {match.question.question_number}
                                    </span>

                                    {match.question.page_number && (

                                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
                                        Page{" "}
                                        {match.question.page_number}
                                      </span>

                                    )}

                                  </div>

                                  <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">
                                    {match.question.text}
                                  </p>

                                  <a
                                    href={
                                      getPaperUrl(
                                        match.question.paper_id,
                                        match.question.page_number
                                      )
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-6 inline-flex rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                                  >
                                    Open {match.question.year} paper
                                  </a>

                                </div>

                                {/* Older / similar question */}

                                <div className="p-6">

                                  <div className="flex flex-wrap items-center gap-2">

                                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                      {match.similar_question.year}
                                    </span>

                                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                      {match.similar_question.exam}
                                    </span>

                                    <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                      Question{" "}
                                      {match.similar_question.question_number}
                                    </span>

                                    {match.similar_question.page_number && (

                                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
                                        Page{" "}
                                        {match.similar_question.page_number}
                                      </span>

                                    )}

                                  </div>

                                  <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">
                                    {match.similar_question.text}
                                  </p>

                                  <a
                                    href={
                                      getPaperUrl(
                                        match.similar_question.paper_id,
                                        match.similar_question.page_number
                                      )
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-6 inline-flex rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                                  >
                                    Open {match.similar_question.year} paper
                                  </a>

                                </div>

                              </div>

                            </article>

                          );
                        }
                      )}

                    </div>

                  )}

                </div>

                {/* =================================================
                    TOPIC FREQUENCY MATRIX
                ================================================= */}

                {trendData.topics.length > 0 && (

                  <div className="mt-10">

                    <div className="mb-5">

                      <p className="text-sm font-medium text-zinc-500">
                        TOPIC FREQUENCY
                      </p>

                      <h3 className="mt-2 text-xl font-semibold">
                        Topic history by year
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Each value shows how many questions from a recurring
                        topic appeared in that exam year. Click a non-zero
                        value to inspect those questions.
                      </p>

                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">

                      <table className="w-full min-w-[650px] border-collapse">

                        <thead>

                          <tr className="border-b border-zinc-800">

                            <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Topic
                            </th>

                            {trendData.papers_years.map(
                              (
                                yearValue
                              ) => (

                                <th
                                  key={
                                    yearValue
                                  }
                                  className="px-5 py-4 text-center text-xs font-medium uppercase tracking-wide text-zinc-500"
                                >
                                  {yearValue}
                                </th>

                              )
                            )}

                            <th className="px-5 py-4 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Total
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {trendData.topics.map(
                            (
                              topic
                            ) => (

                              <tr
                                key={
                                  topic.id
                                }
                                className="border-b border-zinc-800 last:border-b-0"
                              >

                                <td className="max-w-xs px-5 py-4">

                                  <p className="font-medium leading-6 text-zinc-200">
                                    {topic.topic}
                                  </p>

                                  <p className="mt-1 text-xs text-zinc-600">
                                    {Math.round(
                                      topic.cohesion *
                                      100
                                    )}% cohesion
                                  </p>

                                </td>

                                {trendData.papers_years.map(
                                  (
                                    yearValue
                                  ) => {

                                    const count =
                                      getTopicYearCount(
                                        topic,
                                        yearValue
                                      );

                                    const isSelected =
                                      selectedMatrixCell?.topicId ===
                                        topic.id &&
                                      selectedMatrixCell.year ===
                                        yearValue;

                                    return (

                                      <td
                                        key={
                                          yearValue
                                        }
                                        className="px-4 py-4 text-center"
                                      >

                                        {count > 0 ? (

                                          <button
                                            onClick={() =>
                                              handleMatrixCellClick(
                                                topic,
                                                yearValue
                                              )
                                            }
                                            className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
                                              isSelected
                                                ? "border-white bg-white text-black"
                                                : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                                            }`}
                                          >
                                            {count}
                                          </button>

                                        ) : (

                                          <span className="text-sm text-zinc-700">
                                            —
                                          </span>

                                        )}

                                      </td>

                                    );
                                  }
                                )}

                                <td className="px-5 py-4 text-center font-semibold text-zinc-300">
                                  {topic.question_count}
                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                )}

                {/* =================================================
                    SELECTED MATRIX CELL QUESTIONS
                ================================================= */}

                {selectedMatrixCell &&
                 selectedMatrixTopic && (

                  <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">

                    <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 bg-zinc-900/70 px-6 py-5 md:flex-row md:items-center">

                      <div>

                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          SELECTED YEAR
                        </p>

                        <h3 className="mt-2 text-lg font-semibold">
                          {selectedMatrixTopic.topic}
                        </h3>

                        <p className="mt-1 text-sm text-zinc-400">
                          {selectedMatrixCell.year} ·{" "}
                          {selectedMatrixQuestions.length}{" "}
                          {selectedMatrixQuestions.length === 1
                            ? "question"
                            : "questions"}
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          setSelectedMatrixCell(
                            null
                          )
                        }
                        className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white md:self-auto"
                      >
                        Close
                      </button>

                    </div>

                    {selectedMatrixQuestions.map(
                      (
                        question
                      ) => (

                        <div
                          key={
                            question.id
                          }
                          className="border-b border-zinc-800 px-6 py-6 last:border-b-0"
                        >

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                              {question.year}
                            </span>

                            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                              {question.exam}
                            </span>

                            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                              Question{" "}
                              {question.question_number}
                            </span>

                            {question.page_number && (

                              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                                Page{" "}
                                {question.page_number}
                              </span>

                            )}

                          </div>

                          <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">
                            {question.text}
                          </p>

                          <a
                            href={
                              getPaperUrl(
                                question.paper_id,
                                question.page_number
                              )
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-5 inline-flex rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                          >
                            Open source paper
                          </a>

                        </div>

                      )
                    )}

                  </div>

                )}

                {/* =================================================
                    TOPIC CARDS
                ================================================= */}

                {trendData.topics.length > 0 && (

                  <div className="mt-10">

                    <div className="mb-5">

                      <p className="text-sm font-medium text-zinc-500">
                        TOPIC DETAILS
                      </p>

                      <h3 className="mt-2 text-xl font-semibold">
                        Recurring topic breakdown
                      </h3>

                    </div>

                    <div className="space-y-4">

                      {trendData.topics.map(
                        (
                          topic,
                          index
                        ) => {

                          const isOpen =
                            openTopics.includes(
                              topic.id
                            );

                          const cohesionPercent =
                            Math.round(
                              topic.cohesion *
                              100
                            );

                          const maximumYearCount =
                            getTopicMaximumYearCount(
                              topic
                            );

                          return (

                            <article
                              key={
                                topic.id
                              }
                              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                            >

                              {/* Topic header */}

                              <button
                                onClick={() =>
                                  toggleTopic(
                                    topic.id
                                  )
                                }
                                className="w-full px-6 py-6 text-left transition hover:bg-zinc-900"
                              >

                                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">

                                  <div className="min-w-0">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                                        Topic{" "}
                                        {index + 1}
                                      </span>

                                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                                        {topic.question_count}{" "}
                                        {topic.question_count === 1
                                          ? "question"
                                          : "questions"}
                                      </span>

                                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                                        {topic.appearance_count}{" "}
                                        {topic.appearance_count === 1
                                          ? "year"
                                          : "years"}
                                      </span>

                                    </div>

                                    <h3 className="mt-4 text-xl font-semibold leading-8">
                                      {topic.topic}
                                    </h3>

                                    <div className="mt-4 flex flex-wrap gap-2">

                                      {topic.years.map(
                                        (
                                          yearValue
                                        ) => (

                                          <span
                                            key={
                                              yearValue
                                            }
                                            className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400"
                                          >
                                            {yearValue}
                                          </span>

                                        )
                                      )}

                                    </div>

                                  </div>

                                  <div className="flex shrink-0 items-center gap-4">

                                    <div className="text-right">

                                      <p className="text-xs uppercase tracking-wide text-zinc-600">
                                        Cohesion
                                      </p>

                                      <p className="mt-1 font-medium text-zinc-300">
                                        {cohesionPercent}%
                                      </p>

                                    </div>

                                    <span className="text-2xl text-zinc-500">
                                      {isOpen
                                        ? "−"
                                        : "+"}
                                    </span>

                                  </div>

                                </div>

                              </button>

                              {/* Expanded topic */}

                              {isOpen && (

                                <div className="border-t border-zinc-800">

                                  {/* Frequency bars */}

                                  <div className="border-b border-zinc-800 bg-zinc-900/40 px-6 py-6">

                                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Frequency by year
                                    </p>

                                    <div className="mt-5 space-y-4">

                                      {trendData.papers_years.map(
                                        (
                                          yearValue
                                        ) => {

                                          const count =
                                            getTopicYearCount(
                                              topic,
                                              yearValue
                                            );

                                          const widthPercentage =
                                            count === 0
                                              ? 0
                                              : Math.max(
                                                  10,
                                                  (
                                                    count /
                                                    maximumYearCount
                                                  ) *
                                                    100
                                                );

                                          return (

                                            <div
                                              key={
                                                yearValue
                                              }
                                            >

                                              <div className="mb-2 flex items-center justify-between gap-4">

                                                <span className="text-sm font-medium text-zinc-300">
                                                  {yearValue}
                                                </span>

                                                <span className="text-sm text-zinc-500">
                                                  {count}{" "}
                                                  {count === 1
                                                    ? "question"
                                                    : "questions"}
                                                </span>

                                              </div>

                                              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">

                                                {count > 0 && (

                                                  <div
                                                    className="h-full rounded-full bg-zinc-300 transition-all"
                                                    style={{
                                                      width:
                                                        `${widthPercentage}%`,
                                                    }}
                                                  />

                                                )}

                                              </div>

                                            </div>

                                          );
                                        }
                                      )}

                                    </div>

                                  </div>

                                  {/* Questions heading */}

                                  <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">

                                    <p className="text-sm text-zinc-500">
                                      Past-paper questions grouped into this recurring topic
                                    </p>

                                  </div>

                                  {/* Questions */}

                                  {topic.questions.map(
                                    (
                                      question
                                    ) => (

                                      <div
                                        key={
                                          question.id
                                        }
                                        className="border-b border-zinc-800 px-6 py-6 last:border-b-0"
                                      >

                                        <div className="flex flex-wrap items-center gap-2">

                                          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                            {question.year}
                                          </span>

                                          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                            {question.exam}
                                          </span>

                                          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                                            Question{" "}
                                            {question.question_number}
                                          </span>

                                          {question.page_number && (

                                            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                                              Page{" "}
                                              {question.page_number}
                                            </span>

                                          )}

                                        </div>

                                        <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">
                                          {question.text}
                                        </p>

                                        <a
                                          href={
                                            getPaperUrl(
                                              question.paper_id,
                                              question.page_number
                                            )
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-5 inline-flex rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                                        >
                                          Open source paper
                                        </a>

                                      </div>

                                    )
                                  )}

                                </div>

                              )}

                            </article>

                          );
                        }
                      )}

                    </div>

                  </div>

                )}

              </div>

            )}

          </section>

        )}

        {/* =====================================================
            UPLOAD
        ===================================================== */}

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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-zinc-500"
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
                placeholder="2025"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-zinc-500"
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-zinc-500"
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
                  event.target.files?.[0];

                if (selectedFile) {
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

        {/* =====================================================
            LIBRARY
        ===================================================== */}

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

            <div className="space-y-4">

              {Object.keys(
                groupedPapers
              )
                .sort()
                .map(
                  (
                    moduleName
                  ) => {

                    const modulePapers =
                      groupedPapers[
                        moduleName
                      ];

                    const isOpen =
                      openModules.includes(
                        moduleName
                      );

                    return (

                      <div
                        key={
                          moduleName
                        }
                        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                      >

                        <button
                          onClick={() =>
                            toggleModule(
                              moduleName
                            )
                          }
                          className="flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-zinc-800/50"
                        >

                          <div>

                            <h3 className="text-lg font-semibold">
                              {moduleName}
                            </h3>

                            <p className="mt-1 text-sm text-zinc-500">

                              {modulePapers.length}{" "}

                              {modulePapers.length === 1
                                ? "paper"
                                : "papers"}

                            </p>

                          </div>

                          <span className="text-xl text-zinc-400">
                            {isOpen
                              ? "−"
                              : "+"}
                          </span>

                        </button>

                        {isOpen && (

                          <div className="border-t border-zinc-800">

                            {modulePapers.map(
                              (
                                paper
                              ) => (

                                <div
                                  key={
                                    paper.id
                                  }
                                  className="flex flex-col justify-between gap-4 border-b border-zinc-800 px-6 py-5 last:border-b-0 md:flex-row md:items-center"
                                >

                                  <div>

                                    <p className="font-medium text-zinc-200">
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
                                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
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

                      </div>

                    );
                  }
                )}

            </div>

          )}

        </section>

      </div>

    </main>
  );
}