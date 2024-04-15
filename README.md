ReputatorBot is a bot that allows users to award reputation points if a user has been helpful. It's main intention is to be used on help and advice subreddits to help indicate users who have a track record of providing useful solutions.

It allows the OP of a post, a mod or a trusted user to reply to a user and award them a point using a bot command, which will be stored as their user flair (optional from v1.2) and stored in a data store. The command can be customisable (by default it is !thanks).

The app gets triggered when a comment is posted or edited, but only never award points twice per comment. It triggers on edit to give the user chance to amend a comment to add the "thanks" command if they forget initially.

You can also set an optional post flair if a point is awarded, such as to mark the question as "Resolved".

## Limitations:

* The optional leaderboard will not pull in points for users until this app awards one. If you have previously used /u/Clippy_Office_Asst or a similar bot to award reputation points in the past, this will make the leaderboard misleading.
* For flair setting options, if you specify both a CSS class and a flair template, the flair template will be used.

## Suggestions

You may wish to create an automod rule that detects phrases like "thank you" and similar in comments that do not have the trigger command, and reply suggesting that they use the command.

I strongly recommend using a command that is not going to be used in "normal" comments, to avoid awarding points accidentally. If you use a ! prefix e.g. !thanks, you will reduce the risk of accidental points awarding.

I recommend testing settings out on a test subreddit before deploying to a real subreddit for the first time.

This app is open source and licenced under the BSD 3-clause licence. You can find the source code [here](https://github.com/fsvreddit/reputatorbot).

## Data stored

This application stores the reputation score awarded by the app for each user in a Redis data store and (if configured) as the user's flair. It also stores a record that a comment has had a point awarded on it for a period of a week after that point is awarded.

If the application is removed from a subreddit, all data is deleted although the flairs will remain. If the application is subsequently re-installed, the existing flairs will be used as a basis for new point awarding.

## Change History

### Version 1.2:

* You can now award points without setting user flair at all if you wish. Points are maintained in the background and the score is visible on the leaderboard (if turned on).
* The message that can be configured when a point is successfully awarded has a new placeholder {{points}} indicating the new score.

### Version 1.1:

* You can now use the placeholder {{permalink}} in replies when you award a point or try and self-award.
* Super users must now use the mod command, not the command that the OP would use. This allows super users to remind people how to award points without accidentally awarding one themselves.
* You can now set a points threshold for users to be automatically considered "trusted".
