"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchApi, type SearchResult } from "@/lib/search-api";
import { cn } from "@/lib/utils";

function SearchResultRow({ result }: { result: SearchResult }) {
  return (
    <Link
      href={`/projects/${result.projectId}?task=${result.taskId}`}
      className="group flex items-center gap-3 rounded-[10px] border border-border bg-card px-3.5 py-3 outline-none transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-tint text-primary">
        <CheckSquare className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {result.title}
        </p>
        <p className="truncate text-[12px] text-text-muted">
          {result.projectName} · {result.columnName}
        </p>
      </div>
      {result.dueDate && (
        <span className="shrink-0 text-[12px] text-text-secondary">
          {format(new Date(result.dueDate), "MMM d")}
        </span>
      )}
    </Link>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-[62px] w-full rounded-[10px]" />
      ))}
    </div>
  );
}

function SearchContent({ initialQuery }: { initialQuery: string }) {
  const [input, setInput] = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery.trim());
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQ(input.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [input]);

  const runSearch = useCallback(async (term: string) => {
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchApi.query(term);
      setResults(data);
    } catch {
      toast.error("Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await runSearch(debouncedQ);
    })();
  }, [debouncedQ, runSearch]);

  const summary = useMemo(() => {
    if (!debouncedQ) return null;
    if (loading) return `Searching for “${debouncedQ}”…`;
    const count = results.length;
    return `${count} result${count === 1 ? "" : "s"} for “${debouncedQ}”`;
  }, [debouncedQ, loading, results.length]);

  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="h-11 pl-9"
          autoFocus
        />
      </div>

      {summary && (
        <p className={cn("text-sm", loading ? "text-text-muted" : "text-text-secondary")}>
          {summary}
        </p>
      )}

      {!debouncedQ && !loading && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <p className="font-display text-base font-semibold text-foreground">
            Search your tasks
          </p>
          <p className="max-w-sm text-sm text-text-secondary">
            Enter a task title or description. Results are limited to projects you can access.
          </p>
        </div>
      )}

      {loading && <SearchSkeleton />}

      {!loading && debouncedQ && results.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-border bg-card px-6 py-14 text-center">
          <p className="font-display text-base font-semibold text-foreground">No results</p>
          <p className="max-w-sm text-sm text-text-secondary">
            No tasks matched “{debouncedQ}” in your accessible projects.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((result) => (
            <SearchResultRow key={result.taskId} result={result} />
          ))}
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <PageHeader
        title="Search"
        subtitle="Find tasks across the projects you can access"
      />
      <SearchContent key={q} initialQuery={q} />
    </div>
  );
}
