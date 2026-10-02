### v2.2.0

* Add support for New Wikis when using the wiki page leaderboard

### v2.1.0

* Improve App Settings by returning groups to settings
* Further mitigations against duplicate actions if Dev Platform is having issues

### v2.0.1

* Mitigate against duplicate actions if the Developer Platform is having issues

### v2.0.0

* Rewrite for Devvit Web, improving leaderboard post format
* Usernames are no longer incorrectly escaped when preceded by u/
* Clarified misleading configuration option

### v1.6.0

* Allow customisable flair text using a placeholder
* Allow regular and mod-only keyword to be the same

### v1.5.4

* No user facing changes - Devvit update only.

### v1.5.3

* Ensure that "you have been awarded" messages go to the awardee, not the awarder

### v1.5.2

* Fixes a security vulnerability relating to menu items

### v1.5.1

* Flairs that start with a number but are not purely numeric are no longer treated as if they are the user's existing score
* Add a feature to manually set a user's points (you can find it on a comment's context menu)

### v1.5

* Support for multiple user keywords
* Support for regular expressions for user keywords
* Add feature to optionally notify a user who has been awarded a point
* Internal efficiency changes

### v1.4.8

* No user facing changes. Check frequency reduced to once per 28 days, Devvit version bump and internal code improvements

### v1.4

* Add custom post type to allow a leaderboard to be pinned to the top of your subreddit
* Allow a configurable number of scores on the leaderboard
* Backup and Restore functionality
* Reduce data cleanup interval to 48 hours

### v1.3

* The leaderboard is now updated immediately after a point is awarded, if that point would affect the leaderboard standings
* You can now exclude posts with certain flairs from allowing points to be awarded
* If a user deletes their account, their data will be removed from the app within 24 hours

### v1.2

* You can now award points without setting user flair at all if you wish. Points are maintained in the background and the score is visible on the leaderboard (if turned on)
* The message that can be configured when a point is successfully awarded has a new placeholder {{points}} indicating the new score

### v1.1

* You can now use the placeholder {{permalink}} in replies when you award a point or try and self-award
* Super users must now use the mod command, not the command that the OP would use. This allows super users to remind people how to award points without accidentally awarding one themselves
* You can now set a points threshold for users to be automatically considered "trusted"
