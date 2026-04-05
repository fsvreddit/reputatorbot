import { context, reddit, redis } from "@devvit/web/server";
import { T3, UiResponse } from "@devvit/web/shared";
import { Request, Response } from "express";

interface SubmitLeaderboardPostFormValues {
    postTitle: string;
    stickyPost: boolean;
    removeExisting: boolean;
}

export interface CustomPostData {
    postId: T3;
}

export const handleSubmitLeaderboardPostForm = async (request: Request, response: Response) => {
    const { postTitle, stickyPost, removeExisting } = request.body as SubmitLeaderboardPostFormValues;

    const customPostDataKey = "customPostData";

    if (removeExisting) {
        const customPostData = await redis.get(customPostDataKey);
        if (customPostData) {
            const { postId } = JSON.parse(customPostData) as CustomPostData;
            try {
                const post = await reddit.getPostById(postId);
                if (!post.removed && post.authorName !== "[deleted]") {
                    await post.delete();
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error fetching existing leaderboard post: ${errorMessage}`);
            }
        }
    }

    const post = await reddit.submitCustomPost({
        subredditName: context.subredditName,
        title: postTitle,
        textFallback: {
            text: "Sorry, this app is not supported on Old Reddit.",
        },
        entry: "default",
    });

    if (stickyPost) {
        await post.sticky();
    }

    const customPostData: CustomPostData = {
        postId: post.id,
    };

    await redis.set(customPostDataKey, JSON.stringify(customPostData));

    const uiResponse: UiResponse = {
        showToast: "Leaderboard post submitted successfully!",
    };

    return response.json(uiResponse);
};
