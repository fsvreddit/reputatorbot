import { useEffect, useRef, useState } from "react";
import type { LeaderboardResponse, LeaderboardEntry } from "../../shared/index.js";

interface LeaderboardState {
    isLoading: boolean;
    error: string | null;
    data: LeaderboardEntry[] | null;
}

export function Leaderboard (): React.ReactElement {
    const [state, setState] = useState<LeaderboardState>({
        isLoading: true,
        error: null,
        data: null,
    });
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(0);
    const [rowHeight, setRowHeight] = useState(64);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const tableHeaderRef = useRef<HTMLTableSectionElement | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                setState({ isLoading: true, error: null, data: null });
                const response = await fetch("/api/leaderboard");

                if (!response.ok) {
                    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
                }

                const data = (await response.json()) as LeaderboardResponse;
                setState({ isLoading: false, error: null, data: data.entries });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                setState({ isLoading: false, error: errorMessage, data: null });
                console.error("Error fetching leaderboard:", error);
            }
        })();
    }, []);

    useEffect(() => {
        const recalculateRowsPerPage = (): void => {
            if (!tableContainerRef.current || !tableHeaderRef.current) {
                return;
            }

            const containerHeight = tableContainerRef.current.getBoundingClientRect().height;
            const headerHeight = tableHeaderRef.current.getBoundingClientRect().height;
            const availableBodyHeight = Math.max(0, containerHeight - headerHeight);
            const calculatedRowsPerPage = Math.max(1, Math.floor(availableBodyHeight / rowHeight));

            setRowsPerPage(calculatedRowsPerPage);
        };

        recalculateRowsPerPage();

        const resizeObserver = new ResizeObserver(() => {
            recalculateRowsPerPage();
        });

        if (tableContainerRef.current) {
            resizeObserver.observe(tableContainerRef.current);
        }

        window.addEventListener("resize", recalculateRowsPerPage);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", recalculateRowsPerPage);
        };
    }, [rowHeight, state.data?.length]);

    const entries = state.data ?? [];
    const totalPages = Math.max(1, Math.ceil(entries.length / rowsPerPage));
    const clampedPage = Math.min(currentPage, totalPages - 1);

    useEffect(() => {
        if (currentPage !== clampedPage) {
            setCurrentPage(clampedPage);
        }
    }, [currentPage, clampedPage]);

    const pageStart = clampedPage * rowsPerPage;
    const pageEnd = pageStart + rowsPerPage;
    const pagedEntries = entries.slice(pageStart, pageEnd);
    const footerSummary = entries.length === 1
        ? "Showing 1 user"
        : `Showing ${pageStart + 1}-${Math.min(pageEnd, entries.length)} of ${entries.length} users`;

    if (state.isLoading) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="text-center">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="text-center max-w-md">
                    <div className="text-red-500 text-4xl mb-4">⚠️</div>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">Error loading leaderboard</p>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">{state.error}</p>
                </div>
            </div>
        );
    }

    if (!state.data || state.data.length === 0) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">No leaderboard data available yet</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen max-w-4xl mx-auto px-2 py-3 sm:px-4 sm:py-4 md:p-6 flex flex-col gap-3 sm:gap-4">
            <div
                ref={tableContainerRef}
                className="flex-1 min-h-0 overflow-hidden rounded-none border-0 sm:rounded-lg sm:border sm:border-gray-200 sm:dark:border-gray-700"
            >
                <table className="w-full table-fixed">
                    <thead ref={tableHeaderRef}>
                        <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <th className="w-16 sm:w-20 px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Rank
                            </th>
                            <th className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Username
                            </th>
                            <th className="w-24 sm:w-28 md:w-32 px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Points
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedEntries.map((entry, index) => (
                            <tr
                                key={entry.username}
                                ref={index === 0
                                    ? (element) => {
                                            if (element) {
                                                const measuredRowHeight = element.getBoundingClientRect().height;
                                                if (measuredRowHeight > 0 && Math.abs(measuredRowHeight - rowHeight) > 0.5) {
                                                    setRowHeight(measuredRowHeight);
                                                }
                                            }
                                        }
                                    : undefined}
                                className={`border-b border-gray-200 dark:border-gray-700 transition-colors ${
                                    (pageStart + index) % 2 === 0
                                        ? "bg-white dark:bg-gray-950"
                                        : "bg-gray-50 dark:bg-gray-900"
                                } hover:bg-blue-50 dark:hover:bg-gray-800`}
                            >
                                <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500 text-white font-semibold text-xs sm:text-sm">
                                        {entry.rank}
                                    </span>
                                </td>
                                <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-0">
                                    <span className="block truncate text-gray-900 dark:text-gray-100 font-medium" title={`u/${entry.username}`}>
                                        u/
                                        {entry.username}
                                    </span>
                                </td>
                                <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-right">
                                    <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                                        {entry.score}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm text-gray-600 dark:text-gray-400">
                <p>{footerSummary}</p>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setCurrentPage(previousPage => Math.max(0, previousPage - 1));
                        }}
                        disabled={clampedPage === 0}
                        className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Back
                    </button>

                    <span className="min-w-20 text-center text-gray-700 dark:text-gray-200">
                        {clampedPage + 1}
                        {" / "}
                        {totalPages}
                    </span>

                    <button
                        type="button"
                        onClick={() => {
                            setCurrentPage(previousPage => Math.min(totalPages - 1, previousPage + 1));
                        }}
                        disabled={clampedPage >= totalPages - 1}
                        className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
