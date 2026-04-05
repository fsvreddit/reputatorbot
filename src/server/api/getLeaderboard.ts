import { Request, Response } from "express";
import { redis, settings } from "@devvit/web/server";
import { AppSetting, POINTS_STORE_KEY } from "../core";
import type { LeaderboardEntry, LeaderboardResponse } from "../../shared/index.js";

export const getLeaderboard = async (_request: Request, response: Response) => {
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

        return response.status(200).json(leaderboardResponse);
    } catch (error) {
        console.error(`Error fetching leaderboard: ${error}`);
        return response.status(500).json({ error: "Failed to fetch leaderboard" });
    }
};
