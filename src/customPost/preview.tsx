import { Devvit } from "@devvit/public-api";

export const previewPost = (
    <blocks height="tall">
        <vstack minHeight="100%" minWidth="100%" width="100%" alignment="top center" gap="small" grow>
            <hstack alignment="center middle" minWidth="100%" border="thick" padding="small" gap="large">
                <image imageHeight={48} imageWidth={48} url="podium.png" />
                <vstack alignment="center middle" grow>
                    <text style="heading">Top scoring users</text>
                </vstack>
                <image imageHeight={48} imageWidth={48} url="podium.png" />
            </hstack>
            <vstack alignment="middle center" padding="medium" gap="medium" grow>
                <vstack alignment="top start" gap="small" grow>
                    <text>Leaderboard is loading, please wait!</text>
                </vstack>
                <vstack alignment="bottom start" grow>
                    <hstack alignment="middle center" gap="small">
                        <button disabled={true}> &lt; </button>
                        <spacer />
                        <text>1</text>
                        <spacer />
                        <button disabled={true}> &gt; </button>
                    </hstack>
                </vstack>
            </vstack>
        </vstack>
    </blocks>
);
