import { context, reddit, redis, scheduler, settings, WikiPage, ZMember } from "@devvit/web/server";
import pako from "pako";
import pluralize from "pluralize";
import { AppSetting } from "./settings.js";
import { POINTS_STORE_KEY } from "./constants.js";
import z from "zod";
import { UiResponse } from "@devvit/web/shared";
import { scheduleAdhocCleanup, setCleanupForUsers } from "../tasks/cleanup.js";

export interface CompactScore {
    u: string;
    s: number;
}

const schema: z.ZodType<CompactScore[]> = z.array(z.object({
    u: z.string(),
    s: z.number().int(),
}));

export function compressScores (value: CompactScore[]): string {
    return Buffer.from(pako.deflate(JSON.stringify(value))).toString("base64");
}

export function decompressScores (blob: string): CompactScore[] {
    const json = Buffer.from(pako.inflate(Buffer.from(blob, "base64"))).toString();
    return JSON.parse(json) as CompactScore[];
}

const BACKUP_WIKI_PAGE = "reputatorbot/backup";

export async function backupAllScores (): Promise<UiResponse> {
    const backupEnabled = await settings.get<boolean>(AppSetting.EnableBackup);
    if (!backupEnabled) {
        return {
            showToast: "Backup function is disabled in Settings.",
        };
    }

    const currentScores = await redis.zRange(POINTS_STORE_KEY, 0, -1);

    const compactScores = currentScores.map(score => ({ u: score.member, s: score.score } as CompactScore));
    const compressed = compressScores(compactScores);

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage(context.subredditName, BACKUP_WIKI_PAGE);
    } catch {
        //
    }

    const wikiPageOptions = {
        subredditName: context.subredditName,
        page: BACKUP_WIKI_PAGE,
        content: compressed,
    };

    if (wikiPage) {
        await reddit.updateWikiPage(wikiPageOptions);
    } else {
        await reddit.createWikiPage(wikiPageOptions);
        await reddit.updateWikiPageSettings({
            subredditName: context.subredditName,
            page: BACKUP_WIKI_PAGE,
            permLevel: 2, // Mods Only
            listed: true,
        });
    }

    return {
        showToast: {
            text: "ReputatorBot points have been backed up to the wiki",
            appearance: "success",
        },
    };
}

export async function showRestoreForm (): Promise<UiResponse> {
    const restoreEnabled = await settings.get<boolean>(AppSetting.EnableRestore);
    if (!restoreEnabled) {
        return {
            showToast: "Restore function is disabled in Settings.",
        };
    }

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage(context.subredditName, BACKUP_WIKI_PAGE);
    } catch {
        //
    }

    if (!wikiPage) {
        return {
            showToast: "There are no backups to restore",
        };
    }

    return {
        showForm: {
            name: "restoreScoresForm",
            form: {
                title: "Restore ReputatorBot Points",
                fields: [
                    {
                        name: "action",
                        label: "Existing Score Handling",
                        type: "select",
                        options: [
                            { label: "Overwrite a user's score if backup has a higher value than the database", value: "overwrite" },
                            { label: "Skip restore if user already has a score", value: "skip" },
                        ],
                        multiSelect: false,
                        required: true,
                        defaultValue: ["overwrite"],
                    },
                ],
            },
        },
    };
}

export interface RestoreScoresFormValues {
    action: "overwrite" | "skip";
}

export async function restoreFormHandler (restoreFormValues: RestoreScoresFormValues): Promise<UiResponse> {
    const { action } = restoreFormValues;

    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await reddit.getWikiPage(context.subredditName, BACKUP_WIKI_PAGE);
    } catch {
        // Should be impossible, we validated before.
        return {
            showToast: "There are no backups to restore",
        };
    }

    let scores: CompactScore[];
    try {
        const decompressed = decompressScores(wikiPage.content);
        scores = schema.parse(decompressed);
    } catch (error) {
        console.log(error);
        return {
            showToast: "Sorry, the backup could not be decoded or is in an invalid format.",
        };
    }

    const existingScores = await redis.zRange(POINTS_STORE_KEY, 0, -1);

    // Grab scores that do not yet exist in Redis.
    const scoresToAdd = scores.filter(score => score.u && score.s > 0 && !existingScores.some(existingItem => existingItem.member === score.u));
    if (action === "overwrite") {
        scoresToAdd.push(...scores.filter(score => score.u && score.s > 0 && backupScoreIsHigher(score, existingScores)));
    }

    if (!scoresToAdd.length) {
        return {
            showToast: "No scores could be imported with the chosen settings.",
        };
    }

    await redis.zAdd(POINTS_STORE_KEY, ...scoresToAdd.map(score => ({ member: score.u, score: score.s } as ZMember)));

    await setCleanupForUsers(scoresToAdd.map(score => score.u));

    await scheduler.runJob({
        name: "updateLeaderboard",
        runAt: new Date(),
        data: { reason: "Imported data from backup" },
    });

    // Remove "Install Date" redis key, because we can now assume that historical data is populated.
    await redis.del("InstallDate");

    await scheduleAdhocCleanup();

    return {
        showToast: `Successfully imported ${scoresToAdd.length} ${pluralize("score", scoresToAdd.length)}.`,
    };
}

function backupScoreIsHigher (backupScore: CompactScore, existingScores: ZMember[]): boolean {
    const existingScore = existingScores.find(item => item.member === backupScore.u);
    if (!existingScore) {
        return false;
    }
    return backupScore.s > existingScore.score;
}
