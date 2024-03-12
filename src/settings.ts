import {SettingsFormField} from "@devvit/public-api";

export enum ThanksPointsSettingName {
    ThanksCommand = "thanksCommand",
    ModThanksCommand = "modThanksCommand",
    AnyoneCanAwardPoints = "anyoneCanAwardPoints",
    ExcludedUsers = "excludedUsers",
    CSSClass = "thanksCSSClass",
    FlairTemplate = "thanksFlairTemplate",
    NotifyOnError = "notifyOnError",
    NotifyOnErrorTemplate = "notifyOnErrorTemplate",
    NotifyOnSuccess = "notifyOnSuccess",
    NotifyOnSuccessTemplate = "notifyOnSuccessTemplate",
    LeaderboardMode = "leaderboardMode",
    LeaderboardWikiPage = "leaderboardWikiPage",
}

export enum ReplyOptions {
    NoReply = "none",
    ReplyByPM = "replybypm",
    ReplyAsComment = "replybycomment",
}

const replyOptionChoices = [
    {label: "No Notification", value: ReplyOptions.NoReply},
    {label: "Send user a private message", value: ReplyOptions.ReplyByPM},
    {label: "Reply as comment", value: ReplyOptions.ReplyAsComment},
];

export enum LeaderboardMode {
    Off = "off",
    ModOnly = "modonly",
    Public = "public",
}

export enum TemplateDefaults {
    NotifyOnErrorTemplate = "Hello {{authorname}},\n\nYou cannot award a point to yourself.\n\nPlease contact the mods if you have any questions.\n\n---\n\n^(I am a bot)",
    NotifyOnSuccessTemplate = "You have awarded 1 point to {{awardeeusername}}.\n\n---\n\n^(I am a bot - please contact the mods with any questions)",
}

const wikiPageNameRegex = /^[\w/]+$/i;

export const settingsForThanksPoints: SettingsFormField[] = [
    {
        type: "group",
        label: "Reputation Points Settings",
        fields: [
            {
                name: ThanksPointsSettingName.ThanksCommand,
                type: "string",
                label: "Command for users to award points",
                defaultValue: "!thanks",
                onValidate: ({value}) => {
                    if (!value) {
                        return "You must specify a command";
                    }
                },
            },
            {
                name: ThanksPointsSettingName.ModThanksCommand,
                type: "string",
                label: "Command for mods to award points",
                defaultValue: "!modthanks",
            },
            {
                name: ThanksPointsSettingName.AnyoneCanAwardPoints,
                type: "boolean",
                label: "Allow any user to award points",
                helpText: "If turned off, only the OP, mods and superusers may award points",
                defaultValue: false,
            },
            {
                name: ThanksPointsSettingName.ExcludedUsers,
                type: "string",
                label: "Users who shouldn't have points awarded",
                helpText: "Optional. Enter a comma-separated list of users who shouldn't have points awarded.",
            },
        ],
    },
    {
        type: "group",
        label: "Points Setting Options",
        fields: [
            {
                name: ThanksPointsSettingName.CSSClass,
                type: "string",
                label: "CSS class to use for points flairs",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: ThanksPointsSettingName.FlairTemplate,
                type: "string",
                label: "Flair template ID to use for points flairs",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: ThanksPointsSettingName.NotifyOnError,
                type: "select",
                label: "Notify users by replying to their command if they try to award a point to themselves accidentally",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
            },
            {
                name: ThanksPointsSettingName.NotifyOnErrorTemplate,
                type: "paragraph",
                label: "Template of message sent when a user tries to award themselves a point",
                helpText: "Placeholder supported: {{authorname}}",
                defaultValue: TemplateDefaults.NotifyOnErrorTemplate,
            },
            {
                name: ThanksPointsSettingName.NotifyOnSuccess,
                type: "select",
                label: "Notify users by replying to their command if their points command works",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
            },
            {
                name: ThanksPointsSettingName.NotifyOnSuccessTemplate,
                type: "paragraph",
                label: "Template of message sent when a user successfully awards a point",
                helpText: "Placeholders supported: {{authorname}}, {{awardeeusername}}",
                defaultValue: TemplateDefaults.NotifyOnSuccessTemplate,
            },
        ],
    },
    {
        type: "group",
        label: "Leaderboard Settings",
        fields: [
            {
                name: ThanksPointsSettingName.LeaderboardMode,
                type: "select",
                options: [
                    {label: "Off", value: LeaderboardMode.Off},
                    {label: "Mod Only", value: LeaderboardMode.ModOnly},
                    {label: "Default settings for wiki", value: LeaderboardMode.Public},
                ],
                label: "Leaderboard Mode",
                multiSelect: false,
                defaultValue: [LeaderboardMode.Off],
            },
            {
                name: ThanksPointsSettingName.LeaderboardWikiPage,
                type: "string",
                label: "Leaderboard Wiki Page",
                defaultValue: "reputatorbotleaderboard",
                onValidate: ({value}) => {
                    if (value && !wikiPageNameRegex.test(value)) {
                        return "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.";
                    }
                },
            },
        ],
    },
];
