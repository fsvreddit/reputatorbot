/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type CleanupJobData = {
    fromCron: boolean;
    jobGuid?: string;
};

export type UpdateLeaderboardJobData = {
    reason: string;
    jobGuid: string;
};
