import { Request, Response } from "express";
import { OnCommentSubmitRequest } from "@devvit/web/shared";
import { handleThanksEvent } from "../core/thanksPoints";

export const onCommentSubmit = async (request: Request, response: Response) => {
    const commentSubmitRequest = request.body as OnCommentSubmitRequest;
    await handleThanksEvent(commentSubmitRequest);

    return response.status(200).json({ message: "comment submitted" });
};
