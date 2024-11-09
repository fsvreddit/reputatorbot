import { SettingsFormField, SettingsFormFieldValidatorEvent } from "@devvit/public-api";

export enum AppSetting {
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
    NotifyAwardedUser = "notifyAwardedUser",
    NotifyAwardedUserTemplate = "notifyAwardedUserTemplate",
    SetPostFlairOnThanks = "setPostFlairOnThanks",
    SetPostFlairText = "setPostFlairOnThanksText",
    SetPostFlairCSSClass = "setPostFlairOnThanksCSSClass",
    SetPostFlairTemplate = "setPostFlairOnThanksTemplate",
    LeaderboardMode = "leaderboardMode",
    LeaderboardWikiPage = "leaderboardWikiPage",
    LeaderboardSize = "leaderboardSize",
    LeaderboardHelpPage = "leaderboardHelpPage",
    PostFlairTextToIgnore = "postFlairTextToIgnore",
    EnableBackup = "enableBackup",
    EnableRestore = "enableRestore",
    PrioritiseScoreFromFlair = "prioritiseScoreFromFlair",
}

export enum ExistingFlairOverwriteHandling {
    OverwriteNumeric = "overwritenumeric",
    OverwriteAll = "overwriteall",
    NeverSet = "neverset",
}

export enum ReplyOptions {
    NoReply = "none",
    ReplyByPM = "replybypm",
    ReplyAsComment = "replybycomment",
}

const replyOptionChoices = [
    { label: "No Notification", value: ReplyOptions.NoReply },
    { label: "Send user a private message", value: ReplyOptions.ReplyByPM },
    { label: "Reply as comment", value: ReplyOptions.ReplyAsComment },
];

export enum LeaderboardMode {
    Off = "off",
    ModOnly = "modonly",
    Public = "public",
}

export enum TemplateDefaults {
    NotifyOnErrorTemplate = "Hello {{authorname}},\n\nYou cannot award a point to yourself.\n\nPlease contact the mods if you have any questions.\n\n---\n\n^(I am a bot)",
    NotifyOnSuccessTemplate = "You have awarded 1 point to {{awardeeusername}}.\n\n---\n\n^(I am a bot - please contact the mods with any questions)",
    NotifyAwardedUserTemplate = "Hello {{awardeeusername}},\n\nYou have been awarded a point for your contribution! New score: {{score}}\n\n---\n\n^(I am a bot - please contact the mods with any questions)",
    NotifyOnSuperuserTemplate = "Hello {{authorname}},\n\nNow that you have reached {{threshold}} points you can now award points yourself, even if you're not the OP. Please use the command \"{{pointscommand}}\" if you'd like to do this.\n\n---\n\n^(I am a bot - please contact the mods with any questions)",
}

function isFlairTemplateValid (event: SettingsFormFieldValidatorEvent<string>) {
    const flairTemplateRegex = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){4}[0-9a-f]{8}$/;
    if (event.value && !flairTemplateRegex.test(event.value)) {
        return "Invalid flair template ID";
    }
}

function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>) {
    if (!event.value || event.value.length !== 1) {
        return "You must choose an option";
    }
}

export const appSettings: SettingsFormField[] = [
    {
        type: "group",
        label: "Reputation Points Settings",
        fields: [
            {
                name: AppSetting.ThanksCommand,
                type: "string",
                label: "Command for users to award reputation points",
                defaultValue: "!thanks",
                onValidate: ({ value }) => {
                    if (!value) {
                        return "You must specify a command";
                    }
                },
            },
            {
                name: AppSetting.ModThanksCommand,
                type: "string",
                label: "Alternate command for mods and trusted users to award reputation points",
                helpText: "Optional.",
                defaultValue: "!modthanks",
            },
            {
                name: AppSetting.AnyoneCanAwardPoints,
                type: "boolean",
                label: "Allow any user to award points",
                helpText: "If turned off, only the OP, mods and named trusted users may award points",
                defaultValue: false,
            },
            {
                name: AppSetting.SuperUsers,
                type: "string",
                label: "A list of trusted users other than mods who can award points",
                helpText: "Optional. Enter a comma-separated list of users who can award points in addition to mods using the mod command",
            },
            {
                name: AppSetting.AutoSuperuserThreshold,
                type: "number",
                label: "Treat users with this many points as automatically a trusted user",
                helpText: "If zero, only explicitly named users above will be treated as trusted users",
            },
            {
                name: AppSetting.NotifyOnAutoSuperuser,
                type: "select",
                label: "Notify users who reach the auto trusted user threshold",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                name: AppSetting.NotifyOnAutoSuperuserTemplate,
                type: "paragraph",
                label: "Template of message sent when a user reaches the trusted user threshold",
                helpText: "Placeholder supported: {{authorname}}, {{permalink}}, {{threshold}}, {{pointscommand}}",
                defaultValue: TemplateDefaults.NotifyOnSuperuserTemplate,
            },
            {
                name: AppSetting.UsersWhoCannotBeAwardedPoints,
                type: "string",
                label: "Users who shouldn't have points awarded to them",
                helpText: "Optional. Enter a comma-separated list of users who shouldn't have points awarded to them.",
            },
            {
                name: AppSetting.UsersWhoCannotAwardPoints,
                type: "string",
                label: "Users who are not permitted to award points",
                helpText: "Optional. Enter a comma-separated list of users who are not able to award points",
            },
            {
                name: AppSetting.PostFlairTextToIgnore,
                type: "string",
                label: "Optional. A list of post flairs (comma separated) for posts where points cannot be awarded",
            },
            {
                name: AppSetting.PrioritiseScoreFromFlair,
                type: "boolean",
                label: "Use score from flair in precedence over score from database",
                helpText: "This may be useful if you want to be able to manually set a score via a flair.",
                defaultValue: false,
            },
        ],
    },
    {
        type: "group",
        label: "Points Setting Options",
        fields: [
            {
                name: AppSetting.ExistingFlairHandling,
                type: "select",
                label: "Flair setting option",
                options: [
                    { label: "Set flair to new score, if flair unset or flair is numeric", value: ExistingFlairOverwriteHandling.OverwriteNumeric },
                    { label: "Set flair to new score, if user has no flair", value: ExistingFlairOverwriteHandling.OverwriteAll },
                    { label: "Never set flair", value: ExistingFlairOverwriteHandling.NeverSet },
                ],
                multiSelect: false,
                defaultValue: [ExistingFlairOverwriteHandling.OverwriteNumeric],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                name: AppSetting.CSSClass,
                type: "string",
                label: "CSS class to use for points flairs",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: AppSetting.FlairTemplate,
                type: "string",
                label: "Flair template ID to use for points flairs",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
                onValidate: isFlairTemplateValid,
            },
            {
                name: AppSetting.NotifyOnError,
                type: "select",
                label: "Notify users by replying to their command if they try to award a point to themselves accidentally",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                name: AppSetting.NotifyOnErrorTemplate,
                type: "paragraph",
                label: "Template of message sent when a user tries to award themselves a point",
                helpText: "Placeholder supported: {{authorname}}, {{permalink}}",
                defaultValue: TemplateDefaults.NotifyOnErrorTemplate,
            },
            {
                name: AppSetting.NotifyOnSuccess,
                type: "select",
                label: "Notify users by replying to their command if their points command works",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                name: AppSetting.NotifyOnSuccessTemplate,
                type: "paragraph",
                label: "Template of message sent when a user successfully awards a point",
                helpText: "Placeholders supported: {{authorname}}, {{awardeeusername}}, {{permalink}}, {{score}}",
                defaultValue: TemplateDefaults.NotifyOnSuccessTemplate,
            },
            {
                name: AppSetting.NotifyAwardedUser,
                type: "select",
                label: "Notify users who have had a point awarded",
                options: replyOptionChoices,
                multiSelect: false,
                defaultValue: [ReplyOptions.NoReply],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                name: AppSetting.NotifyAwardedUserTemplate,
                type: "paragraph",
                label: "Template of message sent when a user successfully awards a point",
                helpText: "Placeholders supported: {{authorname}}, {{awardeeusername}}, {{permalink}}, {{score}}",
                defaultValue: TemplateDefaults.NotifyAwardedUserTemplate,
            },
        ],
    },
    {
        type: "group",
        label: "Post Flair Setting Options",
        fields: [
            {
                name: AppSetting.SetPostFlairOnThanks,
                type: "boolean",
                label: "Set post flair when a reputation point is awarded",
                helpText: "This can be used to mark a question as resolved, or answered",
                defaultValue: false,
            },
            {
                name: AppSetting.SetPostFlairText,
                type: "string",
                label: "Post Flair Text",
            },
            {
                name: AppSetting.SetPostFlairCSSClass,
                type: "string",
                label: "Post Flair CSS Class",
                helpText: "Optional. Please choose either a CSS class or flair template, not both.",
            },
            {
                name: AppSetting.SetPostFlairTemplate,
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
                name: AppSetting.LeaderboardMode,
                type: "select",
                options: [
                    { label: "Off", value: LeaderboardMode.Off },
                    { label: "Mod Only", value: LeaderboardMode.ModOnly },
                    { label: "Default settings for wiki", value: LeaderboardMode.Public },
                ],
                label: "Wiki Leaderboard Mode",
                multiSelect: false,
                defaultValue: [LeaderboardMode.Off],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                name: AppSetting.LeaderboardWikiPage,
                type: "string",
                label: "Leaderboard Wiki Page",
                defaultValue: "reputatorbotleaderboard",
                onValidate: ({ value }) => {
                    const wikiPageNameRegex = /^[\w/]+$/i;
                    if (value && !wikiPageNameRegex.test(value)) {
                        return "Invalid wiki page name. Wiki page name must consist of alphanumeric characters and / characters only.";
                    }
                },
            },
            {
                name: AppSetting.LeaderboardSize,
                type: "number",
                label: "Leaderboard Size",
                defaultValue: 20,
                onValidate: ({ value }) => {
                    if (value && (value < 10 || value > 100)) {
                        return "Value should be between 10 and 100";
                    }
                },
            },
            {
                name: AppSetting.LeaderboardHelpPage,
                type: "string",
                label: "Leaderboard Help Page",
                helpText: "Optional. A web page (e.g. on your wiki, or an announcement post) telling users how to use reputation points on your subreddit",
            },
        ],
    },
    {
        type: "group",
        label: "Backup and Restore",
        fields: [
            {
                name: AppSetting.EnableBackup,
                type: "boolean",
                label: "Enable Backup",
                defaultValue: true,
            },
            {
                name: AppSetting.EnableRestore,
                type: "boolean",
                label: "Enable Restore",
                helpText: "This should be left disabled to prevent inadvertent score overwriting. Only enable during restore operations.",
                defaultValue: false,
            },
        ],
    },
];
