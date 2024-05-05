import {Context, CustomPostType, Devvit, MenuItemOnPressEvent} from "@devvit/public-api";
import {LeaderboardRow} from "./leaderboardRow.js";
import {LeaderboardState} from "./state.js";

export async function createCustomPost (event: MenuItemOnPressEvent, context: Context) {
    await context.reddit.submitPost({
        subredditName: "fsvsandbox",
        title: "ReputatorBot High Scores",
        preview: (
            <vstack padding="medium" cornerRadius="medium">
                <text style="heading" size="medium">
                    Loading ReputatorBot Leaderboard...
                </text>
            </vstack>
        ),
    });
}

export const leaderboardCustomPost: CustomPostType = {
    name: "leaderboardCustomPost",
    description: "Post that displays ReputatorBot high scorers",
    height: "tall",
    render: context => {
        console.log("Leaderboard State");
        const state = new LeaderboardState(context);
        const subredditName = state.subredditName[0];

        console.log("Rendering custom post");

        return (
            <blocks height="tall">
                <vstack minHeight={"100%"} minWidth={"100%"} width="100%" alignment="top center" gap="small" grow>
                    <hstack alignment="center middle" minWidth="100%" border="thick" padding="small" gap="large">
                        <image imageHeight={48} imageWidth={48} url="podium.png" />
                        <vstack alignment="center middle" grow>
                            <text style="heading">Top scoring users</text>
                        </vstack>
                        {state.leaderboardHelpUrl[0] ? <button icon="help" onPress={() => {
                            state.context.ui.navigateTo(state.leaderboardHelpUrl[0]);
                        }}></button> : <image imageHeight={48} imageWidth={48} url="podium.png" />}
                    </hstack>
                    <vstack alignment="middle center" padding="medium" gap="medium" grow>
                        <vstack alignment="top start" gap="small" grow>
                            {state.leaderboard.slice((state.page - 1) * state.leaderboardPageSize, state.page * state.leaderboardPageSize).map(entry => <LeaderboardRow username={entry.username} userId={entry.userId} score={entry.score} navigateToProfile={() => {
                                context.ui.navigateTo(`https://reddit.com/u/${entry.username}`);
                            }} />)}
                        </vstack>
                        <vstack alignment="bottom start" grow>
                            <hstack alignment="middle center" gap="small">
                                <button disabled={state.page === 1} onPress={() => {
                                    state.page -= 1;
                                }}> &lt; </button>
                                <spacer />
                                <text onPress={() => {
                                    state.page = 1;
                                }}>{state.page}</text>
                                <spacer />
                                <button disabled={state.page === state.maxPage} onPress={() => {
                                    state.page += 1;
                                }}> &gt; </button>
                            </hstack>
                        </vstack>
                    </vstack>
                </vstack>
            </blocks>
        );
    },
};
