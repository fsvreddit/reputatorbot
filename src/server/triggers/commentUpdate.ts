import { OnCommentUpdateRequest } from "@devvit/web/shared";
import { Request, Response } from "express";
import { handleThanksEvent } from "../core/thanksPoints";

export const onCommentUpdate = async (request: Request, response: Response) => {
    const commentUpdateRequest = request.body as OnCommentUpdateRequest;
    await handleThanksEvent(commentUpdateRequest);

    return response.status(200).json({ message: "comment updated" });
};
