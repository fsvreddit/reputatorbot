import {SettingsFormField, SettingsFormFieldValidatorEvent} from "@devvit/public-api";

export enum ThanksPointsSettingName {
    ThanksCommand = "thanksCommand",
    ModThanksCommand = "modThanksCommand",
    AnyoneCanAwardPoints = "anyoneCanAwardPoints",
    SuperUsers = "superUsers",
    ExcludedUsers = "excludedUsers",
    ExistingFlairHandling = "existingFlairHandling",
    ExistingFlairCosmeticHandling = "existingFlairCosmeticHandling",
    CSSClass = "thanksCSSClass",
    FlairTemplate = "thanksFlairTemplate",
    NotifyOnError = "notifyOnError",
    NotifyOnErrorTemplate = "notifyOnErrorTemplate",
    NotifyOnSuccess = "notifyOnSuccess",
    NotifyOnSuccessTemplate = "notifyOnSuccessTemplate",
    SetPostFlairOnThanks = "setPostFlairOnThanks",
    SetPostFlairText = "setPostFlairOnThanksText",
    SetPostFlairCSSClass = "setPostFlairOnThanksCSSClass",
    SetPostFlairTemplate = "setPostFlairOnThanksTemplate",
    LeaderboardMode = "leaderboardMode",
    LeaderboardWikiPage = "leaderboardWikiPage",
}

export enum ExistingFlairOverwriteHandling {
    OverwriteNumeric = "overwritenumeric",
    OverwriteAll = "overwriteall",
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

function isFlairTemplateValid (event: SettingsFormFieldValidatorEvent<string>): void | string {
    const flairTemplateRegex = /^[0-9a-z]{8}(?:-[0-9a-z]{4}){4}[0-9a-z]{8}$/;
    if (event.value && !flairTemplateRegex.test(event.value)) {
        return "Invalid flair template ID";
    }
}

export const appSettings: SettingsFormField[] = [
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
                helpText: "If turned off, only the OP, mods and named trusted users may award points",
                defaultValue: false,
            },
            {
                name: ThanksPointsSettingName.SuperUsers,
                type: "string",
                label: "A list of trusted users other than mods who can award points",
                helpText: "Optional. Enter a comma-separated list of users who can award points in addition to OP",
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
                name: ThanksPointsSettingName.ExistingFlairHandling,
                type: "select",
                label: "Existing user flair handling",
                options: [
                    {label: "Overwrite Numeric Only", value: ExistingFlairOverwriteHandling.OverwriteNumeric},
                    {label: "Overwrite Any Flair", value: ExistingFlairOverwriteHandling.OverwriteAll},
                ],
                multiSelect: false,
                defaultValue: [ExistingFlairOverwriteHandling.OverwriteNumeric],
            },
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
                onValidate: isFlairTemplateValid,
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
        label: "Post Flair Setting Options",
        fields: [
            {
                name: ThanksPointsSettingName.SetPostFlairOnThanks,
                type: "boolean",
                label: "Set post flair when a reputation point is awarded",
                helpText: "This can be used to mark a question as resolved, or answered",
                defaultValue: false,
            },
            {
                name: ThanksPointsSettingName.SetPostFlairText,
                type: "string",
                label: "Post Flair Text",
            },
            {
                name: ThanksPointsSettingName.SetPostFlairCSSClass,
                type: "string",
                label: "Post Flair CSS Class",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: ThanksPointsSettingName.SetPostFlairTemplate,
                type: "string",
                label: "Post Flair Template ID",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
                onValidate: isFlairTemplateValid,
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
