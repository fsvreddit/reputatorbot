import {SettingsFormField, SettingsFormFieldValidatorEvent} from "@devvit/public-api";

export enum SettingName {
    ThanksCommand = "thanksCommand",
    ModThanksCommand = "modThanksCommand",
    AnyoneCanAwardPoints = "anyoneCanAwardPoints",
    SuperUsers = "superUsers",
    AutoSuperuserThreshold = "autoSuperuserThreshold",
    NotifyOnAutoSuperuser = "notifyOnAutoSuperuser",
    NotifyOnAutoSuperuserTemplate = "notifyOnAutoSuperuserTemplate",
    UsersWhoCannotBeAwardedPoints = "excludedUsers",
    UsersWhoCannotAwardPoints = "usersWhoCantAwardPoints",
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
    NotifyOnSuperuserTemplate = "Hello {{authorname}},\n\nNow that you have reached {{threshold}} points you can now award points yourself, even if you're not the OP. Please use the command \"{{pointscommand}}\" if you'd like to do this.\n\n---\n\n^(I am a bot - please contact the mods with any questions)",
}

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
                name: SettingName.ThanksCommand,
                type: "string",
                label: "Command for users to award reputation points",
                defaultValue: "!thanks",
                onValidate: ({value}) => {
                    if (!value) {
                        return "You must specify a command";
                    }
                },
            },
            {
                name: SettingName.ModThanksCommand,
                type: "string",
                label: "Alternate command for mods and trusted users to award reputation points",
                helpText: "Optional.",
                defaultValue: "!modthanks",
            },
            {
                name: SettingName.AnyoneCanAwardPoints,
                type: "boolean",
                label: "Allow any user to award points",
                helpText: "If turned off, only the OP, mods and named trusted users may award points",
                defaultValue: false,
            },
            {
                name: SettingName.SuperUsers,
                type: "string",
                label: "A list of trusted users other than mods who can award points",
                helpText: "Optional. Enter a comma-separated list of users who can award points in addition to mods using the mod command",
            },
            {
                name: SettingName.AutoSuperuserThreshold,
                type: "number",
                label: "Treat users with this many points as automatically a trusted user",
                helpText: "If zero, only explicitly named users above will be treated as trusted users",
            },
            {
                name: SettingName.NotifyOnAutoSuperuser,
                type: "select",
                label: "Notify users who reach the auto trusted user threshold",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
            },
            {
                name: SettingName.NotifyOnAutoSuperuserTemplate,
                type: "paragraph",
                label: "Template of message sent when a user reaches the trusted user threshold",
                helpText: "Placeholder supported: {{authorname}}, {{permalink}}, {{threshold}}, {{pointscommand}}",
                defaultValue: TemplateDefaults.NotifyOnSuperuserTemplate,
            },
            {
                name: SettingName.UsersWhoCannotBeAwardedPoints,
                type: "string",
                label: "Users who shouldn't have points awarded to them",
                helpText: "Optional. Enter a comma-separated list of users who shouldn't have points awarded to them.",
            },
            {
                name: SettingName.UsersWhoCannotAwardPoints,
                type: "string",
                label: "Users who are not permitted to award points",
                helpText: "Optional. Enter a comma-separated list of users who are not able to award points",
            },
        ],
    },
    {
        type: "group",
        label: "Points Setting Options",
        fields: [
            {
                name: SettingName.ExistingFlairHandling,
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
                name: SettingName.CSSClass,
                type: "string",
                label: "CSS class to use for points flairs",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: SettingName.FlairTemplate,
                type: "string",
                label: "Flair template ID to use for points flairs",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
                onValidate: isFlairTemplateValid,
            },
            {
                name: SettingName.NotifyOnError,
                type: "select",
                label: "Notify users by replying to their command if they try to award a point to themselves accidentally",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
            },
            {
                name: SettingName.NotifyOnErrorTemplate,
                type: "paragraph",
                label: "Template of message sent when a user tries to award themselves a point",
                helpText: "Placeholder supported: {{authorname}}, {{permalink}}",
                defaultValue: TemplateDefaults.NotifyOnErrorTemplate,
            },
            {
                name: SettingName.NotifyOnSuccess,
                type: "select",
                label: "Notify users by replying to their command if their points command works",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
            },
            {
                name: SettingName.NotifyOnSuccessTemplate,
                type: "paragraph",
                label: "Template of message sent when a user successfully awards a point",
                helpText: "Placeholders supported: {{authorname}}, {{awardeeusername}}, {{permalink}}",
                defaultValue: TemplateDefaults.NotifyOnSuccessTemplate,
            },
        ],
    },
    {
        type: "group",
        label: "Post Flair Setting Options",
        fields: [
            {
                name: SettingName.SetPostFlairOnThanks,
                type: "boolean",
                label: "Set post flair when a reputation point is awarded",
                helpText: "This can be used to mark a question as resolved, or answered",
                defaultValue: false,
            },
            {
                name: SettingName.SetPostFlairText,
                type: "string",
                label: "Post Flair Text",
            },
            {
                name: SettingName.SetPostFlairCSSClass,
                type: "string",
                label: "Post Flair CSS Class",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: SettingName.SetPostFlairTemplate,
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
                name: SettingName.LeaderboardMode,
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
                name: SettingName.LeaderboardWikiPage,
                type: "string",
                label: "Leaderboard Wiki Page",
                defaultValue: "reputatorbotleaderboard",
                onValidate: ({value}) => {
                    const wikiPageNameRegex = /^[\w/]+$/i;
                    if (value && !wikiPageNameRegex.test(value)) {
                        return "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.";
                    }
                },
            },
        ],
    },
];
