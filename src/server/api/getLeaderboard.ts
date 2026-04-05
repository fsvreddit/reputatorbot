import type { Context } from "hono";
import { redis, settings } from "@devvit/web/server";
import { AppSetting, POINTS_STORE_KEY } from "../core";
import type { LeaderboardEntry, LeaderboardResponse } from "../../shared/index.js";

export const getLeaderboard = async (c: Context) => {
    try {
        const appSettings = await settings.getAll();
        const leaderboardSize = (appSettings[AppSetting.LeaderboardSize] as number | undefined) ?? 20;

        const highScores = await redis.zRange(POINTS_STORE_KEY, 0, leaderboardSize - 1, {
            by: "rank",
            reverse: true,
        });

        const entries: LeaderboardEntry[] = highScores.map((score, index) => ({
            rank: index + 1,
            username: score.member,
            score: score.score,
        }));

        const leaderboardResponse: LeaderboardResponse = {
            entries,
            size: leaderboardSize,
        };

        return c.json(leaderboardResponse, 200);
    } catch (error) {
        console.error(`Error fetching leaderboard: ${error}`);
        return c.json({ error: "Failed to fetch leaderboard" }, 500);
    }
};
