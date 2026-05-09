import { OnCommentSubmitRequest, TriggerResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { handleThanksEvent } from "../core/thanksPoints";
import { hasTriggerBeenHandled } from "../core";

export const onCommentSubmit = async (c: Context) => {
    const commentSubmitRequest = await c.req.json<OnCommentSubmitRequest>();
    if (!commentSubmitRequest.comment) {
        return c.json<TriggerResponse>({ message: "invalid request: missing comment" }, 400);
    }

    if (await hasTriggerBeenHandled(`commentSubmit:${commentSubmitRequest.comment.id}`)) {
        return c.json<TriggerResponse>({ message: "duplicate trigger ignored" }, 200);
    }

    await handleThanksEvent(commentSubmitRequest);

    return c.json<TriggerResponse>({ message: "comment submitted" }, 200);
};
