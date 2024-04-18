import {ScheduledJobEvent, TriggerContext, ZMember} from "@devvit/public-api";
import {addDays} from "date-fns";
import {POINTS_STORE_KEY} from "./thanksPoints.js";

export const CLEANUP_LOG_POPULATED = "cleanupLogPopulated";
export const CLEANUP_LOG_KEY = "cleanupStore";

async function userActive (username: string, context: TriggerContext): Promise<boolean> {
    try {
        await context.reddit.getUserByUsername(username);
        return true;
    } catch (error) {
        if (error instanceof Error) {
            if (error.stack && error.stack.includes("404 Not Found")) {
                // Deleted or shadowbanned or suspended
                console.log(`Cleanup: ${username} appears to be deleted or suspended.`);
                return false;
            }
        }
        // Other errors may be platform errors, or indicate suspended (but not deleted) users. In those
        // cases we do not want to remove the scores.
        return true;
    }
}

interface UserActive {
    username: string,
    isActive: boolean,
}

export async function cleanupDeletedAccounts (_: ScheduledJobEvent, context: TriggerContext) {
    console.log("Cleanup: Starting cleanup job");
    const items = await context.redis.zRange(CLEANUP_LOG_KEY, 0, new Date().getTime(), {by: "score"});
    if (items.length === 0) {
        // No user accounts need to be checked.
        console.log("Cleanup: No users are due a check.");
        return;
    }

    // Get the first 50 accounts that are due a check.
    const usersToCheck = items.slice(0, 50).map(item => item.member);
    const userStatuses: UserActive[] = [];

    for (const username of usersToCheck) {
        // eslint-disable-next-line no-await-in-loop
        const isActive = await userActive(username, context);
        userStatuses.push(<UserActive>{username, isActive});
    }

    const activeUsers = userStatuses.filter(user => user.isActive);
    const deletedOrSuspendedUsers = userStatuses.filter(user => !user.isActive);

    // For active users, set their next check date to be one day from now.
    if (activeUsers.length > 0) {
        console.log(`Cleanup: ${activeUsers.length} users still active out of ${userStatuses.length}. Resetting next check time.`);
        await context.redis.zAdd(CLEANUP_LOG_KEY, ...activeUsers.map(user => <ZMember>{member: user.username, score: addDays(new Date(), 1).getTime()}));
    }

    // For deleted users, remove them from both the cleanup log and the points score.
    if (deletedOrSuspendedUsers.length > 0) {
        console.log(`Cleanup: ${deletedOrSuspendedUsers.length} users out of ${userStatuses.length} are deleted or suspended. Removing from data store.`);
        await context.redis.zRem(POINTS_STORE_KEY, deletedOrSuspendedUsers.map(user => user.username));
        await context.redis.zRem(CLEANUP_LOG_KEY, deletedOrSuspendedUsers.map(user => user.username));

        // Force an immediate leaderboard update, because some accounts newly cleaned up might have been visible there.
        await context.scheduler.runJob({
            name: "updateLeaderboard",
            runAt: new Date(),
        });
    }
}
