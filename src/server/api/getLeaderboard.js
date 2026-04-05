import { redis, settings } from "@devvit/web/server";
import { AppSetting, POINTS_STORE_KEY } from "../core";
export const getLeaderboard = async (_request, response) => {
    try {
        const appSettings = await settings.getAll();
        const leaderboardSize = appSettings[AppSetting.LeaderboardSize] ?? 20;
        const highScores = await redis.zRange(POINTS_STORE_KEY, 0, leaderboardSize - 1, {
            by: "rank",
            reverse: true,
        });
        const entries = highScores.map((score, index) => ({
            rank: index + 1,
            username: score.member,
            score: score.score,
        }));
        const leaderboardResponse = {
            entries,
            size: leaderboardSize,
        };
        return response.status(200).json(leaderboardResponse);
    }
    catch (error) {
        console.error(`Error fetching leaderboard: ${error}`);
        return response.status(500).json({ error: "Failed to fetch leaderboard" });
    }
};
//# sourceMappingURL=getLeaderboard.js.map