import { redis } from "@devvit/web/server";
import { addDays } from "date-fns";

interface TriggerLockOptions {
    expiration?: Date;
    verboseLogs?: boolean;
}

export async function hasTriggerBeenHandled (identifier: string, opts?: TriggerLockOptions): Promise<boolean> {
    const redisKey = `triggerLock:${identifier}`;
    const txn = await redis.watch(redisKey);
    await txn.multi();

    if (await redis.exists(redisKey)) {
        if (opts?.verboseLogs) {
            console.log(`Trigger Lock: Duplicate trigger for ${identifier} ignored.`);
        }
        await txn.discard();
        return true;
    }

    await txn.set(redisKey, Date.now().toString(), { expiration: opts?.expiration ?? addDays(new Date(), 1) });

    try {
        await txn.exec();
        return false;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (opts?.verboseLogs) {
            console.log(`Trigger Lock: Duplicate trigger for ${identifier} ignored:`, errorMessage);
        }
        return true;
    }
}
