import { OnCommentUpdateRequest } from "@devvit/web/shared";
import type { Context } from "hono";
import { handleThanksEvent } from "../core/thanksPoints";

export const onCommentUpdate = async (c: Context) => {
    const commentUpdateRequest = await c.req.json<OnCommentUpdateRequest>();
    await handleThanksEvent(commentUpdateRequest);

    return c.json({ message: "comment updated" }, 200);
};
