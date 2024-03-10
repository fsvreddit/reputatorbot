ReputatorBot is a bot that allows users to award reputation points if a user has been helpful.

It allows the OP of a post to reply to a user and award them a point using a bot command, which will be stored as their user flair. The command can be customisable (by default it is !thanks).

The app gets triggered when a comment is posted or edited, but only will fire once per comment. 

Limitations:
* The app won't award points if the user has a custom flair set. This app is intended for subreddits where the majority of flairs are the awarded points only.
* The optional leaderboard will not pull in points for users until this app awards one. If you have previously used /u/Clippy_Office_Asst or a similar bot for points in the past, this will make the leaderboard misleading.

Suggestions:

You may wish to create an automod rule that detects phrases like "thank you" and similar in comments that do not have the trigger command, and reply suggesting that they use the command.

I strongly recommend using a command that is not going to be used in "normal" comments, to avoid awarding points accidentally.
