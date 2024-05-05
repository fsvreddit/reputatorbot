import {Context, UseIntervalResult, UseStateResult} from "@devvit/public-api";
import {AppSetting} from "../settings.js";
import {POINTS_STORE_KEY} from "../thanksPoints.js";

export type LeaderboardEntry = {
    username: string;
    userId: string;
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
        this.leaderboardSize = context.useState<number>(async () => await context.settings.get<number>(AppSetting.LeaderboardSize) ?? 20);
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

    async fetchLeaderboard () {
        const leaderboard: LeaderboardEntry[] = [];
        const items = await this.context.redis.zRange(POINTS_STORE_KEY, 0, this.leaderboardSize[0] - 1, {by: "rank", reverse: true});
        let rank = 1;
        for (const item of items) {
            console.log(`Getting user ${item.member}`);
            try {
                // eslint-disable-next-line no-await-in-loop
                const user = await this.context.reddit.getUserByUsername(item.member);
                leaderboard.push({
                    username: item.member,
                    score: item.score,
                    userId: user.id,
                    rank: rank++,
                });
            } catch {
                // User suspended, deleted, etc., cannot show them in leaderboard.
            }
        }

        console.log("Fetched leaderboard");
        return leaderboard;
    }

    async updateLeaderboard () {
        this.leaderboard = await this.fetchLeaderboard();
        this.refresher.start();
    }
}
