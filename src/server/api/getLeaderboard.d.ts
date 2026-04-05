import { Request, Response } from "express";
export interface LeaderboardEntry {
    rank: number;
    username: string;
    score: number;
}
export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    size: number;
}
export declare const getLeaderboard: (_request: Request, response: Response) => Promise<Response<any, Record<string, any>>>;
