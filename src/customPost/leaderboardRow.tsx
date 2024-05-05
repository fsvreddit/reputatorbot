import {Devvit, TriggerContext, ZMember} from "@devvit/public-api";

interface LeaderboardItem {
    username: string,
    userId: string,
    score: number,
    navigateToProfile?: () => void | Promise<void>
}

export async function zItemToLeaderboardItem (item: ZMember, context: TriggerContext): Promise<LeaderboardItem> {
    const user = await context.reddit.getUserByUsername(item.member);
    return {
        username: item.member,
        userId: user.id,
        score: item.score,
    };
}

export const LeaderboardRow = (props: LeaderboardItem) => (
    <hstack cornerRadius="small" gap="small" width="100%" minWidth="100%" grow>
        <avatar size="small" facing="right" id={props.userId} thingId={props.userId} />
        <button onPress={props.navigateToProfile}>{props.username}</button>
        <spacer grow/>
        <zstack alignment="middle center" cornerRadius="full">
            <text>{props.score} points</text>
        </zstack>
        <spacer size="small"/>
    </hstack>
);
