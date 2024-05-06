import {Devvit} from "@devvit/public-api";

interface LeaderboardItem {
    username: string,
    score: number,
    rank: number,
    navigateToProfile?: () => void | Promise<void>
}

export const LeaderboardRow = (props: LeaderboardItem) => (
    <hstack cornerRadius="small" gap="small" width="100%" minWidth="100%" grow>
        <zstack alignment="middle center" height={"36px"} minWidth={"32px"} cornerRadius="full" border="thick">
            <text alignment="middle center">{props.rank}</text>
        </zstack>
        <spacer grow/>
        <button onPress={props.navigateToProfile}>{props.username}</button>
        <spacer grow/>
        <zstack alignment="middle center" height={"36px"} minWidth={"32px"} cornerRadius="full">
            <text>{props.score} points</text>
        </zstack>
        <spacer size="small"/>
    </hstack>
);
