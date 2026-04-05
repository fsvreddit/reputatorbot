import express from "express";
import { createServer, getServerPort } from "@devvit/web/server";
import { handleCleanupJob, updateLeaderboardJob } from "./tasks";
import { onAppInstall, onCommentSubmit, onCommentUpdate } from "./triggers";
import { handleBackupScoresMenu, handleRestoreScoresMenu, handleSetScoreManuallyMenu } from "./menus";
import { handleFlairTemplateValidator, handleFlairTextTemplateIncludesPlaceholderValidator, handleLeaderboardSizeValidator, handleMustSelectCommandValidator, handleSelectFieldHasOptionChosen, handleWikiPageNameValidator } from "./settingsValidators";
import { handleRestoreScoresForm, handleSetScoreManuallyForm } from "./forms";
import { getLeaderboard } from "./api/getLeaderboard";

const application = express();
application.use(express.json());
application.use(express.urlencoded({ extended: true }));
application.use(express.text());

const router = express.Router();

// Triggers
router.post("/internal/triggers/app-install", onAppInstall);
router.post("/internal/triggers/comment-submit", onCommentSubmit);
router.post("/internal/triggers/comment-update", onCommentUpdate);

// Scheduled Jobs
router.post("/internal/tasks/cleanup-job", handleCleanupJob);
router.post("/internal/tasks/update-leaderboard-job", updateLeaderboardJob);

// Settings validators
router.post("/internal/validators/must-select-command", handleMustSelectCommandValidator);
router.post("/internal/validators/flair-text-template-includes-placeholder", handleFlairTextTemplateIncludesPlaceholderValidator);
router.post("/internal/validators/flair-template-valid", handleFlairTemplateValidator);
router.post("/internal/validators/leaderboard-size-valid", handleLeaderboardSizeValidator);
router.post("/internal/validators/wiki-page-name-valid", handleWikiPageNameValidator);
router.post("/internal/validators/select-field-has-option-chosen", handleSelectFieldHasOptionChosen);

// Menus
router.post("/internal/menu/set-score-manually", handleSetScoreManuallyMenu);
router.post("/internal/menu/backup-scores", handleBackupScoresMenu);
router.post("/internal/menu/restore-scores", handleRestoreScoresMenu);

// Form handlers
router.post("/internal/form/set-score-manually", handleSetScoreManuallyForm);
router.post("/internal/form/restore-scores", handleRestoreScoresForm);

// API endpoints
router.get("/api/leaderboard", getLeaderboard);

application.use(router);

const server = createServer(application);
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
