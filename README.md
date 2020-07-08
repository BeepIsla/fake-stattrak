# Fake Stattrak

Apply fake kills to your stattrak and strange weapons in CSGO and TF2.

*I will be using "StatTrak", "CSGO" and "Kill" throughout this README but it also applies to TF2 and any Strange filter*

**While Valve has not banned anyone for modifying their items like this they can ban you if they want to. Use at your own risk. I am not responsible for any damages.**

---

## How does it work?

StatTrak kills count on community servers too, so there logically are only two ways Valve would possibly know that you killed someone: Either the client sends something to let the game know you got a kill or the server does it. So I researched and turns out the server sends something telling the game you got a kill.

This script creates a fake server and fake joins it with a bot account and the account you want to boost a StatTrak weapon on. Valve will think its a real match going on and will allow our fake server to send StatTrak increments.

These StatTrak increments basically just tell Valve to update the item and change the kill-count on it.

## Requirements

- [NodeJS](https://nodejs.org/en/)
- [A bit of JSON knowledge](https://www.json.org/)
- A bot account

## Usage

1. Download this repository
2. Rename `config.json.example` to `config.json`
3. Adjust your config - [More Info](#config)
4. Open a command prompt inside the folder
5. Run `npm install` to install all dependencies
6. Exit out of Steam - [Read Why](#valve-anti-cheat)
7. Run `node index.js`

## Config

- `boostingAccount`: Object - Account details of the account with the item you want to boost
  - `username`: String - Login username
  - `password`: String - Login password
- `botAccount`: Object - Account details of any account
  - `username`: String - Login username
  - `password`: String - Login password
- `itemID`: String - Item ID of the item you want to boost - [How to find the item ID](#find-item-id)
- `appID`: Number - ID of the game your item is from - *Currently only CSGO (`730`) and TF2 (`440`) are supported*
- `eventType`: Number - The event type which defines what stat on an item gets changed - [More Info](#event-type)
- `incrementValue`: Number - How much you want to add to the current item - *Some event types do not support this - In this case either `1` or `null` must be used*
- `repeat`: Number - Amount of times we want to repeat the above request - *Only useful for event types with forced `incrementValue` like CSGO)*

## Valve Anti-Cheat

VAC is a client-side Anti-Cheat, VAC never gets enabled with this. The only thing you can recieve is a `VAC was unable to verify your game session.` or `You cannot play on secure servers for one of the following reasons`. This happens when you are logged into Steam while using this. Simply exit Steam or log out of your account before running this. Once the script is done you can start Steam again. VAC errors have nothing to do with using this, to fix the errors above just follow [Steam's Support Article](https://support.steampowered.com/kb_article.php?ref=2117-ilzv-2837).

## Find Item ID

To find your item ID go to [your inventory](http://steamcommunity.com/my/inventory) and search the item you want to boost, right click it and click `Copy link address`. You will get something like this: `/inventory/#440_2_143113807`, this is the schema it follows: `AppID_Context_ItemID`. Context is irrelevant for you, only AppID and ItemID matter. In this case AppID is `440` and ItemID is `143113807`.

## Event Type

An event type tells Steam what statistic on a weapon you want to modify, this important because some items have multiple different counters. Here is a list of all event types I am aware of and their meaning **(Last Updated: 9th March 2020)**

*Note: Some my not work due to them being only counted on official servers, one example is the MVP counter on music kits.*

<details>
<summary>Counter-Strike: Global Offensive</summary>

| Type ID | Name                                | Internal Name |
|---------|-------------------------------------|---------------|
| 0       | StatTrak™ Confirmed Kills           | Kills         |
| 1       | StatTrak™ Official Competitive MVPs | OCMVPs        |
</details>

<details>
<summary>Team Fortress 2</summary>

| Type ID | Name                                    | Internal Name                       |
|---------|-----------------------------------------|-------------------------------------|
| 0       | Kills                                   | Kills                               |
| 1       | Ubers                                   | Ubers                               |
| 2       | Kill Assists                            | KillAssists                         |
| 3       | Sentry Kills                            | SentryKills                         |
| 4       | Sodden Victims                          | PeeVictims                          |
| 5       | Spies Shocked                           | BackstabsAbsorbed                   |
| 6       | Heads Taken                             | HeadsTaken                          |
| 7       | Humiliations                            | Humiliations                        |
| 8       | Gifts Given                             | GiftsGiven                          |
| 9       | Deaths Feigned                          | FeignDeaths                         |
| 10      | Scouts Killed                           | ScoutsKilled                        |
| 11      | Snipers Killed                          | SnipersKilled                       |
| 12      | Soldiers Killed                         | SoldiersKilled                      |
| 13      | Demomen Killed                          | DemomenKilled                       |
| 14      | Heavies Killed                          | HeaviesKilled                       |
| 15      | Pyros Killed                            | PyrosKilled                         |
| 16      | Spies Killed                            | SpiesKilled                         |
| 17      | Engineers Killed                        | EngineersKilled                     |
| 18      | Medics Killed                           | MedicsKilled                        |
| 19      | Buildings Destroyed                     | BuildingsDestroyed                  |
| 20      | Projectiles Reflected                   | ProjectilesReflected                |
| 21      | Headshot Kills                          | HeadshotKills                       |
| 22      | Airborne Enemy Kills                    | AirborneEnemyKills                  |
| 23      | Gib Kills                               | GibKills                            |
| 24      | Buildings Sapped                        | BuildingsSapped                     |
| 25      | Tickle Fights Won                       | PlayersTickled                      |
| 26      | Opponents Flattened                     | MenTreaded                          |
| 27      | Kills Under A Full Moon                 | KillsDuringFullMoon                 |
| 28      | Dominations                             | StartDominationKills                |
| 30      | Revenges                                | RevengeKills                        |
| 31      | Posthumous Kills                        | PosthumousKills                     |
| 32      | Teammates Extinguished                  | AlliesExtinguished                  |
| 33      | Critical Kills                          | CriticalKills                       |
| 34      | Kills While Explosive-Jumping           | KillsWhileExplosiveJumping          |
| 36      | Sappers Removed                         | SapperDestroyed                     |
| 37      | Cloaked Spies Killed                    | InvisibleSpiesKilled                |
| 38      | Medics Killed That Have Full ÜberCharge | MedicsWithFullUberKilled            |
| 39      | Robots Destroyed                        | RobotsKilled                        |
| 40      | Giant Robots Destroyed                  | MinibossRobotsKilled                |
| 44      | Kills While Low Health                  | LowHealthKill                       |
| 45      | Kills During Halloween                  | HalloweenKills                      |
| 46      | Robots Killed During Halloween          | HalloweenRobotKills                 |
| 47      | Defenders Killed                        | DefenderKills                       |
| 48      | Submerged Enemy Kills                   | UnderwaterKills                     |
| 49      | Kills While Invuln ÜberCharged          | KillsWhileUbercharged               |
| 50      | Food Items Eaten                        | FoodEaten                           |
| 51      | Banners Deployed                        | BannersDeployed                     |
| 58      | Seconds Cloaked                         | TimeCloaked                         |
| 59      | Health Dispensed to Teammates           | HealthGiven                         |
| 60      | Teammates Teleported                    | TeleportsGiven                      |
| 61      | Tanks Destroyed                         | TanksDestroyed                      |
| 62      | Long-Distance Kills                     | LongDistanceKills                   |
| 63      |                                         | UniquePlayerKills                   |
| 64      | Points Scored                           | PointsScored                        |
| 65      | Double Donks                            | DoubleDonks                         |
| 66      | Teammates Whipped                       | TeammatesWhipped                    |
| 67      | Kills during Victory Time               | VictoryTimeKill                     |
| 68      | Robot Scouts Destroyed                  | RobotScoutKill                      |
| 74      | Robot Spies Destroyed                   | RobotSpyKill                        |
| 77      | Taunt Kills                             | TauntKill                           |
| 78      | Unusual-Wearing Player Kills            | PlayerWearingUnusualKill            |
| 79      | Burning Player Kills                    | BurningPlayerKill                   |
| 80      | Killstreaks Ended                       | KillstreaksEnded                    |
| 81      | Freezecam Taunt Appearances             | KillcamTaunts                       |
| 82      | Damage Dealt                            | DamageDealt                         |
| 83      | Fires Survived                          | FiresSurvived                       |
| 84      | Allied Healing Done                     | AllyHealingDone                     |
| 85      | Point Blank Kills                       | PointBlankKill                      |
| 86      | Wrangled Sentry Kills                   | PlayerKillsBySentry                 |
| 87      | Kills                                   | CosmeticKills                       |
| 88      | Full Health Kills                       | FullHealthKills                     |
| 89      | Taunting Player Kills                   | TauntingPlayerKills                 |
| 90      | Carnival Kills                          | HalloweenOverworldKills             |
| 91      | Carnival Underworld Kills               | HalloweenUnderworldKills            |
| 92      | Carnival Games Won                      | HalloweenMinigamesWon               |
| 93      | Not Crit nor MiniCrit Kills             | NonCritKills                        |
| 94      | Players Hit                             | PlayersHit                          |
| 95      | Assists                                 | CosmeticAssists                     |
| 96      | Contracts Completed                     | CosmeticOperationContractsCompleted |
| 97      | Kills                                   | CosmeticOperationKills              |
| 98      | Contract Points                         | CosmeticOperationContractsPoints    |
| 99      | Contract Bonus Points                   | CosmeticOperationBonusObjectives    |
| 100     | Times Performed                         | TauntsPerformed                     |
| 101     | Kills and Assists during Invasion Event | InvasionKills                       |
| 102     | Kills and Assists on 2Fort Invasion     | InvasionKillsOnMap01                |
| 103     | Kills and Assists on Probed             | InvasionKillsOnMap02                |
| 104     | Kills and Assists on Byre               | InvasionKillsOnMap03                |
| 105     | Kills and Assists on Watergate          | InvasionKillsOnMap04                |
| 106     | Souls Collected                         | HalloweenSouls                      |
| 107     | Merasmissions Completed                 | HalloweenContractsCompleted         |
| 108     | Halloween Transmutes Performed          | HalloweenOfferings                  |
| 109     | Power Up Canteens Used                  | PowerupBottlesUsed                  |
| 110     | Contract Points Earned                  | ContractPointsEarned                |
| 111     | Contract Points Contributed To Friends  | ContractPointsContributedToFriends  |
</details>
