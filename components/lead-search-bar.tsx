"use client";

import { useState, useEffect, useRef } from "react";
import { LeadStatus } from "@/app/generated/prisma";
import { PIPELINE_STAGES } from "@/types/lead";

interface SearchResult {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: LeadStatus;
  lastActivity: string;
  lastActivityType: string;
  managedByAutonomous: boolean;
}

interface LeadSearchBarProps {
  onLeadSelect: (leadId: string) => void;
}

export function LeadSearchBar({ onLeadSelect }: LeadSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/leads/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setIsOpen(true);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error("[Search] Error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Escape to close
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }

      // Arrow navigation when dropdown is open
      if (isOpen && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleSelectLead(results[selectedIndex].id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectLead = (leadId: string) => {
    onLeadSelect(leadId);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const getStatusColor = (status: LeadStatus) => {
    const stage = PIPELINE_STAGES.find((s) => s.id === status);
    return stage?.headerBg || "bg-gray-100";
  };

  const getStatusTextColor = (status: LeadStatus) => {
    const stage = PIPELINE_STAGES.find((s) => s.id === status);
    return stage?.textColor || "text-gray-600";
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads... (⌘K)"
          className="w-full px-4 py-2.5 pl-10 pr-10 text-sm border border-[#E5E0D8] dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent bg-[#FAFAF9] dark:bg-gray-800 dark:text-gray-100 shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />

        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55514D] dark:text-gray-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Loading / Clear Button */}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100"
          >
            {isLoading ? (
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-[#E4DDD3] dark:border-gray-700 rounded-lg shadow-xl max-h-[400px] overflow-y-auto"
        >
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => handleSelectLead(result.id)}
              className={`w-full px-4 py-3 text-left hover:bg-[#FBF3E7] dark:hover:bg-gray-700 transition-colors border-b border-[#E4DDD3] dark:border-gray-700 last:border-b-0 ${
                index === selectedIndex ? "bg-[#FBF3E7] dark:bg-gray-700" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Name */}
                  <div className="font-semibold text-[#1C1B1A] dark:text-gray-100 truncate">
                    {result.name}
                    {result.managedByAutonomous && (
                      <span className="ml-2 text-xs text-[#625FFF]">🤖</span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="text-sm text-[#55514D] dark:text-gray-400 truncate">
                    {result.email}
                  </div>

                  {/* Last Activity */}
                  <div className="text-xs text-[#8E8983] dark:text-gray-500 mt-1">
                    {formatTimeAgo(result.lastActivity)}
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  <span
                    className={`${getStatusColor(result.status)} ${getStatusTextColor(result.status)} text-xs px-2.5 py-1 rounded-lg whitespace-nowrap font-medium`}
                  >
                    {PIPELINE_STAGES.find((s) => s.id === result.status)?.label ||
                      result.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && results.length === 0 && query.trim().length >= 2 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-[#E4DDD3] dark:border-gray-700 rounded-lg shadow-xl p-4 text-center text-[#55514D] dark:text-gray-400"
        >
          No leads found matching "{query}"
        </div>
      )}
    </div>
  );
}
