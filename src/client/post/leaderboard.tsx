import { useEffect, useState } from "react";
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
        <div className="w-full max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Reputation Leaderboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Top performers based on community reputation points
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Rank
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Username
                            </th>
                            <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Points
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.data.map((entry, index) => (
                            <tr
                                key={entry.username}
                                className={`border-b border-gray-200 dark:border-gray-700 transition-colors ${
                                    index % 2 === 0
                                        ? "bg-white dark:bg-gray-950"
                                        : "bg-gray-50 dark:bg-gray-900"
                                } hover:bg-blue-50 dark:hover:bg-gray-800`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-semibold text-sm">
                                            {entry.rank}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                        u/
                                        {entry.username}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                                        {entry.score}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                <p>
                    {"Showing top "}
                    {state.data.length}
                    {" users"}
                </p>
            </div>
        </div>
    );
}
