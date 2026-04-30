export enum AppSetting {
    ThanksCommand = "thanksCommand",
    ThanksCommandUsesRegex = "thanksCommandUsesRegex",
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
    FlairTextTemplate = "thanksFlairTextTemplate",
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
