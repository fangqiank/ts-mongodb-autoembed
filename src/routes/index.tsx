import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { searchDocs, keywordSearchDocs, getDocContent } from "../lib/search";

const SECTIONS = [
  "guides",
  "adapters",
  "api",
  "getting-started",
  "protocol",
  "reference",
  "community-adapters",
  "architecture",
] as const;

type SearchResult = {
  _id: string;
  title: string;
  section: string;
  slug: string;
  content: string;
  score: number;
};

type ColumnKind = "keyword" | "vector";

export const Route = createFileRoute("/")({ component: SearchPage });

function SearchPage() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>("");
  const [keywordResults, setKeywordResults] = useState<SearchResult[]>([]);
  const [vectorResults, setVectorResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, sec: string) => {
    if (!q.trim()) {
      setKeywordResults([]);
      setVectorResults([]);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        query: q,
        ...(sec && { section: sec }),
        limit: 10,
      };
      const [keyword, vector] = await Promise.all([
        keywordSearchDocs({ data: payload }),
        searchDocs({ data: payload }),
      ]);
      setKeywordResults(keyword as SearchResult[]);
      setVectorResults(vector as SearchResult[]);
    } catch (err) {
      console.error("Search failed:", err);
      setKeywordResults([]);
      setVectorResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, section), 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, section, doSearch]);

  const handleExpand = async (column: ColumnKind, slug: string) => {
    const key = `${column}:${slug}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedContent(null);
      return;
    }
    setExpandedKey(key);
    setExpandedContent(null);
    setLoadingContent(true);
    try {
      const content = await getDocContent({ data: { slug } });
      setExpandedContent(content ?? "No content found.");
    } catch {
      setExpandedContent("Failed to load content.");
    } finally {
      setLoadingContent(false);
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />

        <div className="relative z-10">
          <p className="island-kicker mb-3 text-center">
            MongoDB autoEmbed + TanStack Start
          </p>
          <h1 className="display-title mb-2 text-center text-4xl font-bold sm:text-5xl">
            TanStack AI Docs Search
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-center text-(--sea-ink-soft)">
            Semantic search across TanStack AI documentation — powered by
            MongoDB Atlas vector search with zero embedding code.
          </p>

          <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search docs… e.g. "how do tools work"'
              className="flex-1 rounded-xl border border-(--line) bg-(--surface-strong) px-4 py-3 text-(--sea-ink) placeholder-(--sea-ink-soft) shadow-sm outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/30"
            />
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="rounded-xl border border-(--line) bg-(--surface-strong) px-4 py-3 text-(--sea-ink) shadow-sm outline-none transition focus:border-(--lagoon) focus:ring-2 focus:ring-(--lagoon)/30"
            >
              <option value="">All sections</option>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--lagoon) border-t-transparent" />
          </div>
        )}

        {!loading && hasQuery && (
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <ResultsColumn
              title="Keyword Search"
              subtitle="Case-insensitive text match on title and content"
              column="keyword"
              results={keywordResults}
              expandedKey={expandedKey}
              expandedContent={expandedContent}
              loadingContent={loadingContent}
              onExpand={handleExpand}
            />
            <ResultsColumn
              title="Vector Search"
              subtitle="Semantic similarity via MongoDB Atlas autoEmbed"
              column="vector"
              results={vectorResults}
              expandedKey={expandedKey}
              expandedContent={expandedContent}
              loadingContent={loadingContent}
              onExpand={handleExpand}
            />
          </div>
        )}

        {!loading && !hasQuery && (
          <div className="mx-auto mt-4 max-w-2xl space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Zero Embedding Code",
                  desc: "autoEmbed handles vectorization — just insert plain text.",
                },
                {
                  label: "Voyage AI Model",
                  desc: "mongot calls Voyage behind the scenes, no SDK needed.",
                },
                {
                  label: "Instant Search",
                  desc: "Pass queryText, get semantically ranked results back.",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="feature-card rounded-2xl border border-(--line) p-5"
                >
                  <h3 className="mb-1 text-sm font-semibold text-(--sea-ink)">
                    {card.label}
                  </h3>
                  <p className="text-xs text-(--sea-ink-soft)">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

type ResultsColumnProps = {
  title: string;
  subtitle: string;
  column: ColumnKind;
  results: SearchResult[];
  expandedKey: string | null;
  expandedContent: string | null;
  loadingContent: boolean;
  onExpand: (column: ColumnKind, slug: string) => void;
};

function ResultsColumn({
  title,
  subtitle,
  column,
  results,
  expandedKey,
  expandedContent,
  loadingContent,
  onExpand,
}: ResultsColumnProps) {
  return (
    <div className="flex flex-col gap-3">
      <header className="px-1">
        <h2 className="text-lg font-semibold text-(--sea-ink)">{title}</h2>
        <p className="text-xs text-(--sea-ink-soft)">{subtitle}</p>
      </header>

      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--line) px-4 py-8 text-center text-sm text-(--sea-ink-soft)">
          No results.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const key = `${column}:${result.slug}`;
            const isExpanded = expandedKey === key;
            return (
              <button
                key={`${column}:${result._id}`}
                type="button"
                onClick={() => onExpand(column, result.slug)}
                className="feature-card block w-full cursor-pointer rounded-2xl border border-(--line) p-5 text-left transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-full border border-(--chip-line) bg-(--chip-bg) px-2.5 py-0.5 text-xs font-semibold text-(--lagoon-deep)">
                        {result.section}
                      </span>
                      <span className="text-xs text-(--sea-ink-soft)">
                        {column === "vector"
                          ? `${(result.score * 100).toFixed(1)}% match`
                          : result.score >= 1
                            ? "title match"
                            : "content match"}
                      </span>
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-(--sea-ink)">
                      {result.title}
                    </h3>
                    <p className="line-clamp-2 text-sm text-(--sea-ink-soft)">
                      {result.content}
                    </p>
                  </div>
                  <svg
                    className={`mt-1 h-5 w-5 shrink-0 text-(--sea-ink-soft) transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-(--line) pt-4">
                    {loadingContent ? (
                      <div className="flex justify-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--lagoon) border-t-transparent" />
                      </div>
                    ) : (
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-(--foam) p-4 text-sm text-(--sea-ink)">
                        {expandedContent}
                      </pre>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
