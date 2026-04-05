import { OnCommentSubmitRequest } from "@devvit/web/shared";
import type { Context } from "hono";
import { handleThanksEvent } from "../core/thanksPoints";

export const onCommentSubmit = async (c: Context) => {
    const commentSubmitRequest = await c.req.json<OnCommentSubmitRequest>();
    await handleThanksEvent(commentSubmitRequest);

    return c.json({ message: "comment submitted" }, 200);
};
