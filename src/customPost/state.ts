import {Context, UseIntervalResult, UseStateResult} from "@devvit/public-api";
import {AppSetting} from "../settings.js";
import {POINTS_STORE_KEY} from "../thanksPoints.js";
import {CustomPostData} from "./index.js";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type LeaderboardEntry = {
    username: string;
    score: number;
    rank: number;
}

export class LeaderboardState {
    readonly leaderboardSize: UseStateResult<number>;
    readonly leaderboardHelpUrl: UseStateResult<string>;
    readonly leaderboardEntries: UseStateResult<LeaderboardEntry[]>;
    readonly leaderboardPage: UseStateResult<number>;
    readonly leaderboardPageSize: number = 7;
    readonly subredditName: UseStateResult<string>;

    readonly refresher: UseIntervalResult;

    constructor (public context: Context) {
        this.leaderboardSize = context.useState<number>(async () => this.getLeaderboardSize());
        this.leaderboardHelpUrl = context.useState<string>(async () => await context.settings.get<string>(AppSetting.LeaderboardHelpPage) ?? "");
        this.leaderboardEntries = context.useState<LeaderboardEntry[]>(async () => this.fetchLeaderboard());
        this.leaderboardPage = context.useState(1);
        this.subredditName = context.useState<string>(async () => (await context.reddit.getCurrentSubreddit()).name);
        this.refresher = context.useInterval(async () => this.updateLeaderboard(), 60000 * 60);
        this.refresher.start();
    }

    get leaderboard (): LeaderboardEntry[] {
        return this.leaderboardEntries[0];
    }

    set leaderboard (value: LeaderboardEntry[]) {
        this.leaderboardEntries[1](value);
    }

    get page (): number {
        return this.leaderboardPage[0];
    }

    set page (value: number) {
        if (value < 1 || value > this.maxPage) {
            return;
        }

        this.leaderboardPage[1](value);
    }

    get maxPage (): number {
        return Math.ceil(this.leaderboard.length / this.leaderboardPageSize);
    }

    async getLeaderboardSize () {
        const redisKey = "customPostData";
        const data = await this.context.redis.get(redisKey);
        if (!data) {
            return 20;
        }

        const customPostData = JSON.parse(data) as CustomPostData;
        return customPostData.numberOfUsers;
    }

    async fetchLeaderboard () {
        const leaderboard: LeaderboardEntry[] = [];
        const items = await this.context.redis.zRange(POINTS_STORE_KEY, 0, this.leaderboardSize[0] - 1, {by: "rank", reverse: true});
        let rank = 1;
        for (const item of items) {
            leaderboard.push({
                username: item.member,
                score: item.score,
                rank: rank++,
            });
        }

        return leaderboard;
    }

    async updateLeaderboard () {
        this.leaderboard = await this.fetchLeaderboard();
        this.refresher.start();
    }
}
