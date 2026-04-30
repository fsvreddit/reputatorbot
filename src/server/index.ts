import { createServer, getServerPort } from "@devvit/web/server";
import { Hono } from "hono";
import { handleCleanupJob, updateLeaderboardJob } from "./tasks";
import { onAppInstall, onCommentSubmit, onCommentUpdate } from "./triggers";
import { handleBackupScoresMenu, handleRestoreScoresMenu, handleSetScoreManuallyMenu, handleSubmitLeaderboardPostMenu } from "./menus";
import { handleFlairTemplateValidator, handleFlairTextTemplateIncludesPlaceholderValidator, handleLeaderboardSizeValidator, handleMustSelectCommandValidator, handleSelectFieldHasOptionChosen, handleWikiPageNameValidator } from "./settingsValidators";
import { handleRestoreScoresForm, handleSetScoreManuallyForm, handleSubmitLeaderboardPostForm } from "./forms";
import { getLeaderboard } from "./api/getLeaderboard";
import { getRequestListener } from "@hono/node-server";

const application = new Hono();

// Triggers
application.post("/internal/triggers/app-install", onAppInstall);
application.post("/internal/triggers/comment-submit", onCommentSubmit);
application.post("/internal/triggers/comment-update", onCommentUpdate);

// Scheduled Jobs
application.post("/internal/tasks/cleanup-job", handleCleanupJob);
application.post("/internal/tasks/update-leaderboard-job", updateLeaderboardJob);

// Settings validators
application.post("/internal/validators/must-select-command", handleMustSelectCommandValidator);
application.post("/internal/validators/flair-text-template-includes-placeholder", handleFlairTextTemplateIncludesPlaceholderValidator);
application.post("/internal/validators/flair-template-valid", handleFlairTemplateValidator);
application.post("/internal/validators/leaderboard-size-valid", handleLeaderboardSizeValidator);
application.post("/internal/validators/wiki-page-name-valid", handleWikiPageNameValidator);
application.post("/internal/validators/select-field-has-option-chosen", handleSelectFieldHasOptionChosen);

// Menus
application.post("/internal/menu/set-score-manually", handleSetScoreManuallyMenu);
application.post("/internal/menu/backup-scores", handleBackupScoresMenu);
application.post("/internal/menu/restore-scores", handleRestoreScoresMenu);
application.post("/internal/menu/submit-leaderboard-post", handleSubmitLeaderboardPostMenu);

// Form handlers
application.post("/internal/form/set-score-manually", handleSetScoreManuallyForm);
application.post("/internal/form/restore-scores", handleRestoreScoresForm);
application.post("/internal/form/submit-leaderboard-post", handleSubmitLeaderboardPostForm);

// API endpoints
application.get("/api/leaderboard", getLeaderboard);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
