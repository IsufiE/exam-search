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

type MainView = "search" | "trends" | "library" | "upload";

type SelectedMatrixCell = {
  topicId: string;
  year: number;
} | null;

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

const uploadYears = Array.from(
  { length: 27 },
  (_, index) => 2026 - index
);

const uploadExams = [
  "January",
  "May",
  "Repeat",
];

export default function Home() {
  // =========================================================
  // Upload state
  // =========================================================

  const [module, setModule] = useState("");
  const [year, setYear] = useState("");
  const [exam, setExam] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [addingNewModule, setAddingNewModule] =
    useState(false);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  // =========================================================
  // Library state
  // =========================================================

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [papersError, setPapersError] = useState("");
  const [libraryModule, setLibraryModule] = useState("");
  const [libraryYear, setLibraryYear] = useState("");
  const [libraryExam, setLibraryExam] = useState("");

  function clearLibraryFilters() {
    setLibraryModule("");
    setLibraryYear("");
    setLibraryExam("");
  }

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
              (!selectedModule ||
                paper.module === selectedModule) &&
              (!selectedYear ||
                paper.year === Number(selectedYear))
          )
          .map((paper) => paper.exam)
      )
    ).sort();
  }, [papers, selectedModule, selectedYear]);

  // =========================================================
  // Portfolio stats
  // =========================================================

  const indexedYears = useMemo(() => {
    return Array.from(
      new Set(
        papers.map((paper) => paper.year)
      )
    ).sort((a, b) => b - a);
  }, [papers]);

  // =========================================================
  // Grouped library
  // =========================================================

  const libraryExams = useMemo(
    () => [...new Set(papers.map((paper) => paper.exam))].sort(),
    [papers],
  );
  const hasLibraryFilters = Boolean(libraryModule || libraryYear || libraryExam);
  const filteredPapers = useMemo(
    () =>
      papers.filter(
        (paper) =>
          (!libraryModule || paper.module === libraryModule) &&
          (!libraryYear || paper.year === Number(libraryYear)) &&
          (!libraryExam || paper.exam === libraryExam),
      ),
    [papers, libraryModule, libraryYear, libraryExam],
  );

  const groupedPapers = useMemo(() => {
    const groups: Record<string, Paper[]> = {};

    for (const paper of filteredPapers) {
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
  }, [filteredPapers]);

  // =========================================================
  // Selected matrix data
  // =========================================================

  const selectedMatrixTopic = useMemo(() => {
    if (!trendData || !selectedMatrixCell) {
      return null;
    }

    return (
      trendData.topics.find(
        (topic) =>
          topic.id === selectedMatrixCell.topicId
      ) || null
    );
  }, [trendData, selectedMatrixCell]);

  const selectedMatrixQuestions = useMemo(() => {
    if (!selectedMatrixTopic || !selectedMatrixCell) {
      return [];
    }

    return selectedMatrixTopic.questions.filter(
      (question) =>
        question.year === selectedMatrixCell.year
    );
  }, [selectedMatrixTopic, selectedMatrixCell]);

  // =========================================================
  // Load papers
  // =========================================================

  async function loadPapers() {
    const signal = AbortSignal.timeout(10_000);

    try {
      setLoadingPapers(true);
      setPapersError("");

      const response = await fetch(`${API}/papers`, { signal });

      if (!response.ok) {
        throw new Error("Could not load papers");
      }

      const data = await response.json();

      setPapers(data);
    } catch (error) {
      console.error(error);

      setPapersError(
        signal.aborted
          ? "The paper list took too long to load. Check that the backend is responding, then retry."
          : "Could not load papers. Check that the backend is running, then retry.",
      );
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
  }, [availableModules, selectedModule, trendModule]);

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

      return [...current, moduleName];
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

      return [...current, topicId];
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

  function getTopicMaximumYearCount(topic: TrendTopic) {
    if (!trendData) {
      return 1;
    }

    const counts = trendData.papers_years.map(
      (yearValue) =>
        getTopicYearCount(topic, yearValue)
    );

    return Math.max(1, ...counts);
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
    const cleanedModule = module.trim().toUpperCase();

    if (
      !file ||
      !cleanedModule ||
      !year ||
      !exam
    ) {
      setMessage("Please complete all fields.");
      return;
    }

    if (
      addingNewModule &&
      availableModules.some(
        (existingModule) =>
          existingModule.toUpperCase() === cleanedModule
      )
    ) {
      setMessage(
        "This module already exists. Please select it from the dropdown."
      );
      return;
    }

    const formData = new FormData();

    formData.append("module", cleanedModule);
    formData.append("year", year);
    formData.append("exam", exam);
    formData.append("file", file);

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Upload failed"
        );
      }

      setMessage(
        `Uploaded successfully. Found ${data.main_questions_found} main questions and ${data.sub_questions_found} sub-questions.`
      );

      setFile(null);
      setModule("");
      setYear("");
      setExam("");
      setAddingNewModule(false);

      setTrendData(null);
      setOpenTopics([]);
      setSelectedMatrixCell(null);

      setSimilarQuestionsData(null);
      setSimilarQuestionsMessage("");

      await loadPapers();
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

  // =========================================================
  // Delete
  // =========================================================

  async function handleDeletePaper(paperId: string) {
    const confirmed = window.confirm(
      "Delete this paper and all of its parsed questions?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingPaperId(paperId);

      const response = await fetch(
        `${API}/papers/${paperId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Delete failed"
        );
      }

      setPapers((currentPapers) =>
        currentPapers.filter(
          (paper) => paper.id !== paperId
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
        alert(error.message);
      } else {
        alert("Something went wrong.");
      }
    } finally {
      setDeletingPaperId(null);
    }
  }

  // =========================================================
  // Search
  // =========================================================

  async function handleSearch() {
    if (!selectedModule) {
      setSearchMessage("Select a module first.");
      return;
    }

    if (!searchQuery.trim()) {
      setSearchMessage("Paste a question first.");
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
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            module: selectedModule,
            year: selectedYear
              ? Number(selectedYear)
              : null,
            exam: selectedExam || null,
            limit: 10,
            min_score: 0.35,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Search failed"
        );
      }

      setSearchResults(data);

      if (data.length === 0) {
        setSearchMessage(
          "No sufficiently relevant questions found for these filters."
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        setSearchMessage(error.message);
      } else {
        setSearchMessage("Something went wrong.");
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
      setTrendMessage("Select a module first.");
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

      setTrendData(trendsData);

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
        setSimilarQuestionsData(similarData);

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
        setTrendMessage(error.message);
      } else {
        setTrendMessage("Something went wrong.");
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

    return `${baseUrl}#page=${pageNumber}`;
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-[#e9e4d7] text-[#212d27] [color-scheme:light] selection:bg-[#b9d0b4] [&_:is(a,button,input,select,textarea):focus-visible]:outline-2 [&_:is(a,button,input,select,textarea):focus-visible]:outline-offset-2 [&_:is(a,button,input,select,textarea):focus-visible]:outline-[#35654b]">
      <div className="min-h-screen md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-b border-[#c6cbbb] bg-[#dbe2d4] px-4 py-4 md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:px-5 md:py-7">
          <div className="flex items-center gap-2.5 px-2 text-lg font-semibold tracking-tight">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5 shrink-0">
              <path d="M5 4h8l4 4v12H5zM13 4v5h4M8 13h6m-6 3h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exam Search
          </div>

          <nav aria-label="Exam Search views" className="mt-4 grid grid-cols-2 gap-1 md:mt-9 md:grid-cols-1">
            {([
              ["search", "Question search"],
              ["trends", "Exam trends"],
              ["library", "Past papers"],
              ["upload", "Add a paper"],
            ] as const).map(([view, label]) => (
              <button
                key={view}
                type="button"
                aria-current={mainView === view ? "page" : undefined}
                onClick={() => setMainView(view)}
                className={`min-h-11 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${mainView === view
                  ? "bg-[#bfcfba] text-[#1b392b]"
                  : "text-[#33463b] hover:bg-[#cdd8c8]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-12 pt-6 sm:px-8 md:pt-10 lg:px-12">
        {mainView === "search" && (

          <section aria-labelledby="search-title">

            <div className="mb-6">

              <h1 id="search-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Question search
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#47554b]">
                Choose a module, then enter a topic or paste an exam question.
              </p>

            </div>

            <div className="rounded-lg border border-[#cbc5b4] bg-[#f2eddf] p-4 sm:p-6">

              {/* Module */}

              <div>

                <label htmlFor="search-module" className="mb-2 block text-sm font-medium text-[#39493e]">
                  Module
                </label>

                <select
                  id="search-module"
                  value={selectedModule}
                  onChange={(event) => {
                    setSelectedModule(event.target.value);
                    setSelectedYear("");
                    setSelectedExam("");
                    setSearchResults([]);
                    setSearchMessage("");
                  }}
                  className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
                >
                  <option value="">Select a module</option>

                  {availableModules.map((moduleName) => (
                    <option
                      key={moduleName}
                      value={moduleName}
                    >
                      {moduleName}
                    </option>
                  ))}
                </select>

              </div>

              {/* Year and exam */}

              <div className="mt-4 grid gap-4 md:grid-cols-2">

                <div>

                  <label htmlFor="search-year" className="mb-2 block text-sm font-medium text-[#39493e]">
                    Year
                  </label>

                  <select
                    id="search-year"
                    value={selectedYear}
                    onChange={(event) => {
                      setSelectedYear(event.target.value);
                      setSelectedExam("");
                      setSearchResults([]);
                      setSearchMessage("");
                    }}
                    disabled={!selectedModule}
                    className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c] disabled:cursor-not-allowed disabled:border-[#bbb9a8] disabled:bg-[#e1ddce] disabled:text-[#47554b]"
                  >
                    <option value="">All years</option>

                    {availableYears.map((yearValue) => (
                      <option
                        key={yearValue}
                        value={yearValue}
                      >
                        {yearValue}
                      </option>
                    ))}
                  </select>

                </div>

                <div>

                  <label htmlFor="search-exam" className="mb-2 block text-sm font-medium text-[#39493e]">
                    Exam
                  </label>

                  <select
                    id="search-exam"
                    value={selectedExam}
                    onChange={(event) => {
                      setSelectedExam(event.target.value);
                      setSearchResults([]);
                      setSearchMessage("");
                    }}
                    disabled={!selectedModule}
                    className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c] disabled:cursor-not-allowed disabled:border-[#bbb9a8] disabled:bg-[#e1ddce] disabled:text-[#47554b]"
                  >
                    <option value="">All exams</option>

                    {availableExams.map((examName) => (
                      <option
                        key={examName}
                        value={examName}
                      >
                        {examName}
                      </option>
                    ))}
                  </select>

                </div>

              </div>

              {/* Search query */}

              <div className="mt-6">

                <div className="mb-2 flex items-center justify-between gap-4">

                  <label htmlFor="search-query" className="text-sm font-medium text-[#39493e]">
                    Question or concept
                  </label>

                </div>

                <textarea
                  id="search-query"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="e.g. How does TCP handle packet loss?"
                  className="min-h-24 w-full resize-y rounded-xl border border-[#8a9182] bg-[#f2eddf] p-4 leading-7 text-[#212d27] outline-none transition placeholder:text-[#47554b] focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
                />

              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">

                <button
                  onClick={handleSearch}
                  disabled={
                    searching ||
                    !searchQuery.trim() ||
                    !selectedModule
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-[#315a45] px-5 py-3 font-semibold text-white transition hover:bg-[#234532] disabled:cursor-not-allowed disabled:bg-[#d8d9cb] disabled:text-[#47554b]"
                >
                  {searching
                    ? "Searching..."
                    : "Find similar questions"}
                </button>

              </div>

              {searchMessage && (
                <div className="mt-5 rounded-xl border border-[#cbc5b4] bg-[#e8e1d1] px-4 py-3">
                  <p className="text-sm text-[#47554b]">
                    {searchMessage}
                  </p>
                </div>
              )}

              {/* Search results */}

              {searchResults.length > 0 && (

                <div className="mt-10 border-t border-[#cbc5b4] pt-8">

                  <div className="mb-5 flex items-end justify-between">

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47554b]">
                        Results
                      </p>

                      <h3 className="mt-2 text-xl font-semibold">
                        Most relevant questions
                      </h3>
                    </div>

                    <span className="rounded-full border border-[#cbc5b4] bg-[#e8e1d1] px-3 py-1.5 text-xs text-[#47554b]">
                      {searchResults.length}{" "}
                      {searchResults.length === 1
                        ? "match"
                        : "matches"}
                    </span>

                  </div>

                  <div className="space-y-4">

                    {searchResults.map((result, index) => {
                      const relevance = Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round(result.score * 100)
                        )
                      );

                      return (

                        <article
                          key={result.id}
                          className="group rounded-2xl border border-[#cbc5b4] bg-[#e8e1d1] p-6 transition hover:border-[#8a9182]"
                        >

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="rounded-full border border-[#cbc5b4] bg-[#f2eddf] px-3 py-1 text-xs font-medium text-[#47554b]">
                              #{index + 1}
                            </span>

                            <span className="rounded-full border border-[#cbc5b4] bg-[#f2eddf] px-3 py-1 text-xs font-medium text-[#39493e]">
                              {relevance}% relevance
                            </span>

                            {result.page_number && (
                              <span className="rounded-full border border-[#cbc5b4] bg-[#f2eddf] px-3 py-1 text-xs text-[#47554b]">
                                Page {result.page_number}
                              </span>
                            )}

                          </div>

                          <h3 className="mt-5 text-lg font-semibold tracking-tight">
                            {result.module} ·{" "}
                            {result.year} ·{" "}
                            {result.exam}
                          </h3>

                          <p className="mt-1 text-sm text-[#47554b]">
                            Question {result.question_number}
                          </p>

                          <p className="mt-5 whitespace-pre-line leading-7 text-[#39493e]">
                            {result.text}
                          </p>

                          <a
                            href={getPaperUrl(
                              result.paper_id,
                              result.page_number
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#8a9182] bg-[#f2eddf] px-4 py-2 text-sm font-medium text-[#25392e] transition hover:border-[#697969] hover:bg-[#e1ddce]"
                          >
                            Open source paper
                            <span aria-hidden="true">↗</span>
                          </a>

                        </article>

                      );
                    })}

                  </div>

                </div>

              )}

            </div>

          </section>

        )}

        {/* =====================================================
            TRENDS
        ===================================================== */}

        {mainView === "trends" && (

          <section aria-labelledby="trends-title">

            <div className="mb-6">

              <h1 id="trends-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Exam trends
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#47554b]">
                Choose a module to see recurring topics and similar questions across years.
              </p>

            </div>

            <div className="rounded-lg border border-[#cbc5b4] bg-[#f2eddf] p-4 sm:p-6">

              <label htmlFor="trend-module" className="mb-2 block text-sm font-medium text-[#39493e]">
                Module
              </label>

              <select
                id="trend-module"
                value={trendModule}
                onChange={(event) => {
                  setTrendModule(event.target.value);
                  setTrendData(null);
                  setTrendMessage("");
                  setOpenTopics([]);
                  setSelectedMatrixCell(null);
                  setSimilarQuestionsData(null);
                  setSimilarQuestionsMessage("");
                }}
                className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
              >
                <option value="">Select a module</option>

                {availableModules.map((moduleName) => (
                  <option
                    key={moduleName}
                    value={moduleName}
                  >
                    {moduleName}
                  </option>
                ))}
              </select>

              <button
                onClick={handleLoadTrends}
                disabled={loadingTrends || !trendModule}
                className="mt-4 rounded-xl bg-[#315a45] px-5 py-3 font-semibold text-white transition hover:bg-[#234532] disabled:cursor-not-allowed disabled:bg-[#d8d9cb] disabled:text-[#47554b]"
              >
                {loadingTrends
                  ? "Analysing..."
                  : "Analyse trends"}
              </button>

              {trendMessage && (
                <div className="mt-5 rounded-xl border border-[#cbc5b4] bg-[#e8e1d1] px-4 py-3">
                  <p className="text-sm text-[#47554b]">
                    {trendMessage}
                  </p>
                </div>
              )}

              {trendData && (

                <div className="mt-10 border-t border-[#cbc5b4] pt-8">

                  {/* Summary */}

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    {[
                      {
                        label: "Module",
                        value: trendData.module,
                      },
                      {
                        label: "Years analysed",
                        value: trendData.years_analysed,
                      },
                      {
                        label: "Questions",
                        value: trendData.questions_analysed,
                      },
                      {
                        label: "Recurring topics",
                        value: trendData.topic_count,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-[#cbc5b4] bg-[#e8e1d1] p-5"
                      >
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#47554b]">
                          {stat.label}
                        </p>

                        <p className="mt-3 text-xl font-semibold">
                          {stat.value}
                        </p>
                      </div>
                    ))}

                  </div>

                  {/* Year badges */}

                  {trendData.papers_years.length > 0 && (
                    <div className="mt-6 flex flex-wrap items-center gap-2">

                      <span className="mr-2 text-sm text-[#47554b]">
                        Exam years
                      </span>

                      {trendData.papers_years.map((yearValue) => (
                        <span
                          key={yearValue}
                          className="rounded-full border border-[#cbc5b4] bg-[#e8e1d1] px-3 py-1 text-xs text-[#39493e]"
                        >
                          {yearValue}
                        </span>
                      ))}

                    </div>
                  )}

                  {/* =================================================
                      SIMILAR PAST QUESTIONS
                  ================================================= */}

                  <div className="mt-12">

                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47554b]">
                          Similar Past Questions
                        </p>

                        <h3 className="mt-2 text-xl font-semibold tracking-tight">
                          Possible repeated or reworded questions
                        </h3>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#47554b]">
                          Strong semantic matches between questions
                          from different exam years. These indicate
                          similar question patterns rather than
                          guaranteed exact repeats.
                        </p>
                      </div>

                      {similarQuestionsData && (
                        <span className="shrink-0 rounded-full border border-[#cbc5b4] bg-[#e8e1d1] px-3 py-1.5 text-xs text-[#47554b]">
                          {similarQuestionsData.match_count}{" "}
                          {similarQuestionsData.match_count === 1
                            ? "match"
                            : "matches"}
                        </span>
                      )}

                    </div>

                    {similarQuestionsMessage && (
                      <div className="rounded-xl border border-[#cbc5b4] bg-[#e8e1d1] px-5 py-4">
                        <p className="text-sm text-[#47554b]">
                          {similarQuestionsMessage}
                        </p>
                      </div>
                    )}

                    {similarQuestionsData &&
                      similarQuestionsData.matches.length > 0 && (

                        <div className="space-y-5">

                          {similarQuestionsData.matches.map(
                            (match, index) => {
                              const similarityPercent = Math.max(
                                0,
                                Math.min(
                                  100,
                                  Math.round(match.similarity * 100)
                                )
                              );

                              return (

                                <article
                                  key={match.id}
                                  className="overflow-hidden rounded-2xl border border-[#cbc5b4] bg-[#e8e1d1]"
                                >

                                  <div className="flex flex-col justify-between gap-4 border-b border-[#cbc5b4] bg-[#f2eddf] px-6 py-5 sm:flex-row sm:items-center">

                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#47554b]">
                                        Match {index + 1}
                                      </p>

                                      <p className="mt-1 text-sm text-[#47554b]">
                                        Questions from different exam years
                                      </p>
                                    </div>

                                    <div className="shrink-0 rounded-full border border-[#8a9182] bg-[#e8e1d1] px-4 py-2">
                                      <span className="text-sm font-semibold text-[#25392e]">
                                        {similarityPercent}%
                                      </span>

                                      <span className="ml-1 text-xs text-[#47554b]">
                                        similar
                                      </span>
                                    </div>

                                  </div>

                                  <div className="grid md:grid-cols-2">

                                    {[
                                      match.question,
                                      match.similar_question,
                                    ].map((question, questionIndex) => (

                                      <div
                                        key={`${question.id}-${questionIndex}`}
                                        className={`p-6 ${
                                          questionIndex === 0
                                            ? "border-b border-[#cbc5b4] md:border-b-0 md:border-r"
                                            : ""
                                        }`}
                                      >

                                        <div className="flex flex-wrap items-center gap-2">

                                          <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                                            {question.year}
                                          </span>

                                          <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                                            {question.exam}
                                          </span>

                                          <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                                            Question {question.question_number}
                                          </span>

                                          {question.page_number && (
                                            <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#47554b]">
                                              Page {question.page_number}
                                            </span>
                                          )}

                                        </div>

                                        <p className="mt-5 whitespace-pre-line leading-7 text-[#39493e]">
                                          {question.text}
                                        </p>

                                        <a
                                          href={getPaperUrl(
                                            question.paper_id,
                                            question.page_number
                                          )}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#8a9182] bg-[#f2eddf] px-4 py-2 text-sm font-medium text-[#25392e] transition hover:bg-[#e1ddce]"
                                        >
                                          Open {question.year} paper
                                          <span aria-hidden="true">↗</span>
                                        </a>

                                      </div>

                                    ))}

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

                    <div className="mt-12">

                      <div className="mb-5">

                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47554b]">
                          Topic Frequency
                        </p>

                        <h3 className="mt-2 text-xl font-semibold tracking-tight">
                          Topic history by year
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-[#47554b]">
                          Each value shows how many questions from a
                          recurring topic appeared in that exam year.
                          Click a non-zero value to inspect those
                          questions.
                        </p>

                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-[#cbc5b4] bg-[#e8e1d1]">

                        <table className="w-full min-w-[650px] border-collapse">

                          <thead>

                            <tr className="border-b border-[#cbc5b4] bg-[#f2eddf]">

                              <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wide text-[#47554b]">
                                Topic
                              </th>

                              {trendData.papers_years.map(
                                (yearValue) => (
                                  <th
                                    key={yearValue}
                                    className="px-5 py-4 text-center text-xs font-medium uppercase tracking-wide text-[#47554b]"
                                  >
                                    {yearValue}
                                  </th>
                                )
                              )}

                              <th className="px-5 py-4 text-center text-xs font-medium uppercase tracking-wide text-[#47554b]">
                                Total
                              </th>

                            </tr>

                          </thead>

                          <tbody>

                            {trendData.topics.map((topic) => (

                              <tr
                                key={topic.id}
                                className="border-b border-[#cbc5b4] last:border-b-0"
                              >

                                <td className="max-w-xs px-5 py-4">

                                  <p className="font-medium leading-6 text-[#25392e]">
                                    {topic.topic}
                                  </p>

                                  <p className="mt-1 text-xs text-[#47554b]">
                                    {Math.round(topic.cohesion * 100)}% cohesion
                                  </p>

                                </td>

                                {trendData.papers_years.map(
                                  (yearValue) => {
                                    const count = getTopicYearCount(
                                      topic,
                                      yearValue
                                    );

                                    const isSelected =
                                      selectedMatrixCell?.topicId === topic.id &&
                                      selectedMatrixCell.year === yearValue;

                                    return (

                                      <td
                                        key={yearValue}
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
                                                ? "border-[#52795c] bg-[#dce6d7] text-[#234532]"
                                                : "border-[#8a9182] bg-[#f2eddf] text-[#25392e] hover:border-[#52795c] hover:bg-[#e1ddce]"
                                            }`}
                                          >
                                            {count}
                                          </button>

                                        ) : (

                                          <span className="text-sm text-[#39493e]">
                                            —
                                          </span>

                                        )}

                                      </td>

                                    );
                                  }
                                )}

                                <td className="px-5 py-4 text-center font-semibold text-[#39493e]">
                                  {topic.question_count}
                                </td>

                              </tr>

                            ))}

                          </tbody>

                        </table>

                      </div>

                    </div>

                  )}

                  {/* =================================================
                      SELECTED MATRIX QUESTIONS
                  ================================================= */}

                  {selectedMatrixCell && selectedMatrixTopic && (

                    <div className="mt-6 overflow-hidden rounded-2xl border border-[#8a9182] bg-[#e8e1d1]">

                      <div className="flex flex-col justify-between gap-4 border-b border-[#cbc5b4] bg-[#f2eddf] px-6 py-5 md:flex-row md:items-center">

                        <div>

                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#47554b]">
                            Selected year
                          </p>

                          <h3 className="mt-2 text-lg font-semibold">
                            {selectedMatrixTopic.topic}
                          </h3>

                          <p className="mt-1 text-sm text-[#47554b]">
                            {selectedMatrixCell.year} ·{" "}
                            {selectedMatrixQuestions.length}{" "}
                            {selectedMatrixQuestions.length === 1
                              ? "question"
                              : "questions"}
                          </p>

                        </div>

                        <button
                          onClick={() => setSelectedMatrixCell(null)}
                          className="self-start rounded-lg border border-[#8a9182] px-3 py-2 text-sm text-[#47554b] transition hover:bg-[#e1ddce] hover:text-[#212d27] md:self-auto"
                        >
                          Close
                        </button>

                      </div>

                      {selectedMatrixQuestions.map((question) => (

                        <div
                          key={question.id}
                          className="border-b border-[#cbc5b4] px-6 py-6 last:border-b-0"
                        >

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                              {question.year}
                            </span>

                            <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                              {question.exam}
                            </span>

                            <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                              Question {question.question_number}
                            </span>

                            {question.page_number && (
                              <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#47554b]">
                                Page {question.page_number}
                              </span>
                            )}

                          </div>

                          <p className="mt-5 whitespace-pre-line leading-7 text-[#39493e]">
                            {question.text}
                          </p>

                          <a
                            href={getPaperUrl(
                              question.paper_id,
                              question.page_number
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#8a9182] bg-[#f2eddf] px-4 py-2 text-sm font-medium text-[#25392e] transition hover:bg-[#e1ddce]"
                          >
                            Open source paper
                            <span aria-hidden="true">↗</span>
                          </a>

                        </div>

                      ))}

                    </div>

                  )}

                  {/* =================================================
                      TOPIC DETAILS
                  ================================================= */}

                  {trendData.topics.length > 0 && (

                    <div className="mt-12">

                      <div className="mb-5">

                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#47554b]">
                          Topic Details
                        </p>

                        <h3 className="mt-2 text-xl font-semibold tracking-tight">
                          Recurring topic breakdown
                        </h3>

                      </div>

                      <div className="space-y-4">

                        {trendData.topics.map((topic, index) => {
                          const isOpen = openTopics.includes(topic.id);

                          const cohesionPercent = Math.round(
                            topic.cohesion * 100
                          );

                          const maximumYearCount =
                            getTopicMaximumYearCount(topic);

                          return (

                            <article
                              key={topic.id}
                              className="overflow-hidden rounded-2xl border border-[#cbc5b4] bg-[#e8e1d1]"
                            >

                              <button
                                onClick={() => toggleTopic(topic.id)}
                                className="w-full px-6 py-6 text-left transition hover:bg-[#f2eddf]"
                              >

                                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">

                                  <div className="min-w-0">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <span className="rounded-full bg-[#e1ddce] px-3 py-1 text-xs text-[#47554b]">
                                        Topic {index + 1}
                                      </span>

                                      <span className="rounded-full bg-[#e1ddce] px-3 py-1 text-xs text-[#39493e]">
                                        {topic.question_count}{" "}
                                        {topic.question_count === 1
                                          ? "question"
                                          : "questions"}
                                      </span>

                                      <span className="rounded-full bg-[#e1ddce] px-3 py-1 text-xs text-[#39493e]">
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

                                      {topic.years.map((yearValue) => (
                                        <span
                                          key={yearValue}
                                          className="rounded-md border border-[#cbc5b4] px-2.5 py-1 text-xs text-[#47554b]"
                                        >
                                          {yearValue}
                                        </span>
                                      ))}

                                    </div>

                                  </div>

                                  <div className="flex shrink-0 items-center gap-4">

                                    <div className="text-right">

                                      <p className="text-xs uppercase tracking-wide text-[#47554b]">
                                        Cohesion
                                      </p>

                                      <p className="mt-1 font-medium text-[#39493e]">
                                        {cohesionPercent}%
                                      </p>

                                    </div>

                                    <span className="text-2xl text-[#47554b]">
                                      {isOpen ? "−" : "+"}
                                    </span>

                                  </div>

                                </div>

                              </button>

                              {isOpen && (

                                <div className="border-t border-[#cbc5b4]">

                                  {/* Frequency by year */}

                                  <div className="border-b border-[#cbc5b4] bg-[#f2eddf] px-6 py-6">

                                    <p className="text-xs font-medium uppercase tracking-wide text-[#47554b]">
                                      Frequency by year
                                    </p>

                                    <div className="mt-5 space-y-4">

                                      {trendData.papers_years.map(
                                        (yearValue) => {
                                          const count = getTopicYearCount(
                                            topic,
                                            yearValue
                                          );

                                          const widthPercentage =
                                            count === 0
                                              ? 0
                                              : Math.max(
                                                  10,
                                                  (count / maximumYearCount) *
                                                    100
                                                );

                                          return (

                                            <div key={yearValue}>

                                              <div className="mb-2 flex items-center justify-between gap-4">

                                                <span className="text-sm font-medium text-[#39493e]">
                                                  {yearValue}
                                                </span>

                                                <span className="text-sm text-[#47554b]">
                                                  {count}{" "}
                                                  {count === 1
                                                    ? "question"
                                                    : "questions"}
                                                </span>

                                              </div>

                                              <div className="h-2 overflow-hidden rounded-full bg-[#e1ddce]">

                                                {count > 0 && (
                                                  <div
                                                    className="h-full rounded-full bg-[#52795c] transition-all"
                                                    style={{
                                                      width: `${widthPercentage}%`,
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

                                  <div className="border-b border-[#cbc5b4] bg-[#f2eddf] px-6 py-4">

                                    <p className="text-sm text-[#47554b]">
                                      Past-paper questions grouped into this recurring topic
                                    </p>

                                  </div>

                                  {/* Topic questions */}

                                  {topic.questions.map((question) => (

                                    <div
                                      key={question.id}
                                      className="border-b border-[#cbc5b4] px-6 py-6 last:border-b-0"
                                    >

                                      <div className="flex flex-wrap items-center gap-2">

                                        <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                                          {question.year}
                                        </span>

                                        <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                                          {question.exam}
                                        </span>

                                        <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#39493e]">
                                          Question {question.question_number}
                                        </span>

                                        {question.page_number && (
                                          <span className="rounded-full bg-[#f2eddf] px-3 py-1 text-xs text-[#47554b]">
                                            Page {question.page_number}
                                          </span>
                                        )}

                                      </div>

                                      <p className="mt-5 whitespace-pre-line leading-7 text-[#39493e]">
                                        {question.text}
                                      </p>

                                      <a
                                        href={getPaperUrl(
                                          question.paper_id,
                                          question.page_number
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#8a9182] bg-[#f2eddf] px-4 py-2 text-sm font-medium text-[#25392e] transition hover:bg-[#e1ddce]"
                                      >
                                        Open source paper
                                        <span aria-hidden="true">↗</span>
                                      </a>

                                    </div>

                                  ))}

                                </div>

                              )}

                            </article>

                          );
                        })}

                      </div>

                    </div>

                  )}

                </div>

              )}

            </div>

          </section>

        )}

        {/* =====================================================
            LIBRARY
        ===================================================== */}

        {mainView === "library" && (
        <section aria-labelledby="library-title">

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">

            <div>

              <h1 id="library-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Past papers
              </h1>

            </div>

            {!loadingPapers && !papersError && (
              <span
                role="status"
                className="text-sm tabular-nums text-[#47554b]"
              >
                {hasLibraryFilters
                  ? `${filteredPapers.length} of ${papers.length} papers`
                  : `${papers.length} ${papers.length === 1 ? "paper" : "papers"}`}
              </span>
            )}
          </div>

          {!loadingPapers && !papersError && papers.length > 0 && (
            <fieldset className="mb-5 rounded-2xl border border-[#cbc5b4] bg-[#f2eddf] p-4">
              <legend className="px-2 text-sm font-medium text-[#25392e]">
                Filter past papers
              </legend>
              <div className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                {[
                  { label: "Module", value: libraryModule, options: availableModules, setValue: setLibraryModule },
                  { label: "Year", value: libraryYear, options: indexedYears, setValue: setLibraryYear },
                  { label: "Exam", value: libraryExam, options: libraryExams, setValue: setLibraryExam },
                ].map(({ label, value, options, setValue }) => (
                  <label key={label} className="grid min-w-0 gap-1.5 text-sm text-[#39493e]">
                    {label}
                    <select
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-3 py-2.5 text-[#212d27] focus-visible:outline-2 focus-visible:outline-[#35654b]"
                    >
                      <option value="">All {label.toLowerCase()}s</option>
                      {value && !options.some((option) => String(option) === value) && (
                        <option value={value}>{value}</option>
                      )}
                      {options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {hasLibraryFilters && (
                  <button
                    type="button"
                    onClick={clearLibraryFilters}
                    className="justify-self-start rounded-xl px-3 py-2.5 text-sm text-[#39493e] underline underline-offset-4 hover:text-[#212d27]"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </fieldset>
          )}

          {loadingPapers ? (

            <div className="rounded-2xl border border-[#cbc5b4] bg-[#f2eddf] p-8">

              <div className="flex items-center gap-3">

                <div className="h-2 w-2 animate-pulse rounded-full bg-[#3d684e]" />

                <p role="status" className="text-sm text-[#47554b]">
                  Loading indexed papers...
                </p>

              </div>

            </div>

          ) : papersError ? (

            <div className="rounded-2xl border border-red-400 bg-red-100 p-8">

              <p role="alert" className="text-sm text-red-800">
                {papersError}
              </p>

              <button
                onClick={loadPapers}
                className="mt-4 rounded-lg border border-[#8a9182] bg-[#f2eddf] px-4 py-2 text-sm text-[#212d27] transition hover:bg-[#e1ddce]"
              >
                Retry
              </button>

            </div>

          ) : papers.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-[#cbc5b4] bg-[#f2eddf] p-12 text-center">

              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbc5b4] bg-[#e8e1d1] text-[#47554b]">
                □
              </div>

              <p className="mt-4 font-medium text-[#39493e]">
                No papers uploaded yet.
              </p>

              <p className="mt-2 text-sm text-[#47554b]">
                <button type="button" onClick={() => setMainView("upload")} className="font-medium text-[#315a45] underline underline-offset-4">Add a PDF</button> to start your library.
              </p>

            </div>

          ) : filteredPapers.length === 0 ? (
            <p className="rounded-2xl border border-[#cbc5b4] bg-[#f2eddf] p-8 text-center text-sm text-[#39493e]">
              No papers match these filters.
            </p>
          ) : (

            <div className="divide-y divide-[#cbc5b4] overflow-hidden rounded-lg border border-[#cbc5b4]">

              {Object.keys(groupedPapers)
                .sort()
                .map((moduleName) => {
                  const modulePapers =
                    groupedPapers[moduleName];

                  const isOpen =
                    openModules.includes(moduleName);

                  const moduleYears = Array.from(
                    new Set(
                      modulePapers.map(
                        (paper) => paper.year
                      )
                    )
                  ).sort((a, b) => b - a);

                  return (

                    <div
                      key={moduleName}
                      className="bg-[#f2eddf]"
                    >

                      <button
                        aria-expanded={isOpen}
                        onClick={() =>
                          toggleModule(moduleName)
                        }
                        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5 transition hover:bg-[#e1ddce]"
                      >

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-3">

                            <h3 className="text-base font-semibold">
                              {moduleName}
                            </h3>

                            <span className="rounded-full border border-[#cbc5b4] bg-[#e8e1d1] px-2.5 py-1 text-xs text-[#47554b]">
                              {modulePapers.length}{" "}
                              {modulePapers.length === 1
                                ? "paper"
                                : "papers"}
                            </span>

                          </div>

                          <p className="mt-2 text-sm text-[#47554b]">
                            {moduleYears.length > 0
                              ? `${moduleYears[moduleYears.length - 1]}–${moduleYears[0]}`
                              : "No years available"}
                          </p>

                        </div>

                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#cbc5b4] bg-[#e8e1d1] text-lg text-[#47554b]">
                          {isOpen ? "−" : "+"}
                        </span>

                      </button>

                      {isOpen && (

                        <div className="border-t border-[#cbc5b4]">

                          {modulePapers.map((paper) => (

                            <div
                              key={paper.id}
                              className="flex flex-col justify-between gap-4 border-b border-[#cbc5b4] px-6 py-5 last:border-b-0 md:flex-row md:items-center"
                            >

                              <div>

                                <p className="font-medium text-[#25392e]">
                                  {paper.year} · {paper.exam}
                                </p>

                                <p className="mt-2 break-all text-xs text-[#47554b]">
                                  {paper.original_filename}
                                </p>

                              </div>

                              <div className="flex shrink-0 items-center gap-3">

                                <a
                                  href={getPaperUrl(paper.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-lg border border-[#8a9182] bg-[#e8e1d1] px-4 py-2 text-sm text-[#39493e] transition hover:border-[#697969] hover:bg-[#e1ddce]"
                                >
                                  Open PDF
                                  <span aria-hidden="true">↗</span>
                                </a>

                                <button
                                  onClick={() =>
                                    handleDeletePaper(paper.id)
                                  }
                                  disabled={
                                    deletingPaperId === paper.id
                                  }
                                  className="rounded-lg border border-red-400 bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {deletingPaperId === paper.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>

                              </div>

                            </div>

                          ))}

                        </div>

                      )}

                    </div>

                  );
                })}

            </div>

          )}

        </section>

        )}

        {/* =====================================================
            UPLOAD
        ===================================================== */}


        {mainView === "upload" && (
        <section aria-labelledby="upload-title">

          <div className="mb-6">

            <h1 id="upload-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Add a paper
              </h1>

            <p className="mt-2 text-sm text-[#47554b]">
              Add a PDF to make its questions searchable.
            </p>

          </div>

          <div className="rounded-lg border border-[#cbc5b4] bg-[#f2eddf] p-4 sm:p-6">

            {/* =================================================
                MODULE DROPDOWN
            ================================================= */}

            <div>

              <label htmlFor="upload-module" className="mb-2 block text-sm font-medium text-[#39493e]">
                Module
              </label>

              <select
                id="upload-module"
                value={addingNewModule ? "__new__" : module}
                onChange={(event) => {
                  const value = event.target.value;

                  setMessage("");

                  if (value === "__new__") {
                    setAddingNewModule(true);
                    setModule("");
                  } else {
                    setAddingNewModule(false);
                    setModule(value);
                  }
                }}
                className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
              >

                <option value="">
                  Select a module
                </option>

                {availableModules.map((moduleName) => (
                  <option
                    key={moduleName}
                    value={moduleName}
                  >
                    {moduleName}
                  </option>
                ))}

                <option value="__new__">
                  + Add new module
                </option>

              </select>

              {addingNewModule && (

                <div className="mt-4">

                  <label htmlFor="new-module" className="mb-2 block text-sm font-medium text-[#39493e]">
                    New module code
                  </label>

                  <input
                    id="new-module"
                    type="text"
                    value={module}
                    onChange={(event) =>
                      setModule(
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="e.g. CS404"
                    className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition placeholder:text-[#47554b] focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
                  />

                  <p className="mt-2 text-xs text-[#47554b]">
                    New modules will appear in the dropdown after
                    their first paper is uploaded.
                  </p>

                </div>

              )}

            </div>

            {/* =================================================
                YEAR AND EXAM DROPDOWNS
            ================================================= */}

            <div className="mt-5 grid gap-5 md:grid-cols-2">

              {/* Year */}

              <div>

                <label htmlFor="upload-year" className="mb-2 block text-sm font-medium text-[#39493e]">
                  Year
                </label>

                <select
                  id="upload-year"
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    setMessage("");
                  }}
                  className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
                >

                  <option value="">
                    Select a year
                  </option>

                  {uploadYears.map((yearValue) => (
                    <option
                      key={yearValue}
                      value={yearValue}
                    >
                      {yearValue}
                    </option>
                  ))}

                </select>

              </div>

              {/* Exam */}

              <div>

                <label htmlFor="upload-exam" className="mb-2 block text-sm font-medium text-[#39493e]">
                  Exam
                </label>

                <select
                  id="upload-exam"
                  value={exam}
                  onChange={(event) => {
                    setExam(event.target.value);
                    setMessage("");
                  }}
                  className="w-full rounded-xl border border-[#8a9182] bg-[#f2eddf] px-4 py-3.5 text-[#212d27] outline-none transition focus:border-[#52795c] focus:ring-1 focus:ring-[#52795c]"
                >

                  <option value="">
                    Select an exam
                  </option>

                  {uploadExams.map((examName) => (
                    <option
                      key={examName}
                      value={examName}
                    >
                      {examName}
                    </option>
                  ))}

                </select>

              </div>

            </div>

            {/* =================================================
                PDF SELECTOR
            ================================================= */}

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#8a9182] bg-[#e8e1d1] px-6 py-14 text-center transition hover:border-[#52795c] hover:bg-[#e8e1d1]">

              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbc5b4] bg-[#f2eddf] text-[#47554b]">
                ↑
              </div>

              <span className="text-base font-medium">
                {file
                  ? file.name
                  : "Choose a PDF"}
              </span>

              <span className="mt-2 text-sm text-[#47554b]">
                {file
                  ? "File selected and ready to upload"
                  : "Select a university past-paper PDF"}
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
                    setMessage("");
                  }
                }}
              />

            </label>

            {/* Upload button */}

            <button
              onClick={handleUpload}
              disabled={
                uploading ||
                !file ||
                !module.trim() ||
                !year ||
                !exam
              }
              className="mt-6 w-full rounded-xl bg-[#315a45] px-5 py-3 font-semibold text-white transition hover:bg-[#234532] disabled:cursor-not-allowed disabled:bg-[#d8d9cb] disabled:text-[#47554b]"
            >
              {uploading
                ? "Uploading..."
                : "Upload and index paper"}
            </button>

            {message && (
              <div className="mt-5 rounded-xl border border-[#cbc5b4] bg-[#e8e1d1] px-4 py-3">
                <p className="text-sm text-[#47554b]">
                  {message}
                </p>
              </div>
            )}

          </div>

        </section>

        )}
        </main>
      </div>
    </div>
  );
}
