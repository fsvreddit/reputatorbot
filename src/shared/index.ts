export interface LeaderboardEntry {
    rank: number;
    username: string;
    score: number;
}

export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    size: number;
}
