import { OnCommentUpdateRequest } from "@devvit/web/shared";
import type { Context } from "hono";
import { handleThanksEvent } from "../core/thanksPoints";
import { hasTriggerBeenHandled } from "../core";
import { addSeconds } from "date-fns";

export const onCommentUpdate = async (c: Context) => {
    const commentUpdateRequest = await c.req.json<OnCommentUpdateRequest>();
    if (!commentUpdateRequest.comment) {
        return c.json({ message: "invalid request: missing comment" }, 400);
    }

    if (await hasTriggerBeenHandled(`commentUpdate:${commentUpdateRequest.comment.id}`, { expiration: addSeconds(new Date(), 30) })) {
        return c.json({ message: "duplicate trigger ignored" }, 200);
    }

    await handleThanksEvent(commentUpdateRequest);

    return c.json({ message: "comment updated" }, 200);
};
