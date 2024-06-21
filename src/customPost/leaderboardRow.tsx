import {Devvit} from "@devvit/public-api";

interface LeaderboardItem {
    username: string,
    score: number,
    rank: number,
    navigateToProfile?: () => void | Promise<void>
}

export const LeaderboardRow = (props: LeaderboardItem) => (
    <hstack cornerRadius="small" gap="small" width="100%" grow>
        <spacer size="small"/>
        <button onPress={props.navigateToProfile}>{props.username}</button>
        <spacer grow/>
        <zstack alignment="middle center" cornerRadius="full">
            <text>{props.score} points</text>
        </zstack>
        <spacer size="small"/>
    </hstack>
);
