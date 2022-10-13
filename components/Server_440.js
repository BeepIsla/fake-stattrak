const SteamID = require("steamid");
const ServerShared = require("./Server_Shared.js");
const EventTypes = require("../helpers/EventTypes.js");

module.exports = class TF2Server extends ServerShared {
	constructor(map = "pl_badwater", serverName = "Development Test Server") {
		super(440, map, serverName);

		this.map = map;
	}

	login() {
		return new Promise(async (resolve, reject) => {
			try {
				let data = await super.login();

				// Finalizing
				await this.coordinator.sendMessage(
					440,
					this.protobufs.data.tf2.ESOMsg.k_ESOMsg_CacheSubscriptionRefresh,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgSOCacheSubscriptionRefresh", {
						owner: this.steamID.getSteamID64()
					})
				);

				await this.coordinator.sendMessage(
					440,
					this.protobufs.data.tf2.ETFGCMsg.k_EMsgGC_GameServer_LevelInfo,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgGC_GameServer_LevelInfo", {
						level_loaded: true,
						level_name: this.map
					})
				);

				// Done
				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}

	addPlayer(steamID, appTicket) {
		return new Promise(async (resolve, reject) => {
			try {
				steamID = new SteamID(steamID.toString());
			} catch (err) {
				reject(err);
				return;
			}

			try {
				let data = await super.addPlayer(steamID, appTicket);

				await this.coordinator.sendMessage(
					440,
					this.protobufs.data.tf2.ESOMsg.k_ESOMsg_CacheSubscriptionRefresh,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgSOCacheSubscriptionRefresh", {
						owner: steamID.getSteamID64()
					})
				);

				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}

	async incrementKillCountAttribute(killerID, victimID, itemID, eventType, amount) {
		let eventTypeInfo = EventTypes[440]?.[eventType];
		let killerID64 = killerID.getSteamID64();
		let victimID64 = victimID.getSteamID64();

		// Hardcode the maxmium amount of "CMsgIncrementKillCountAttribute_Multiple" children we use at once
		// Steam ignores packets too large so this sadly can't go into the millions
		let maximumMultipleChildren = 10_000;
		let increment = eventTypeInfo?.allowIncrement ? 10_000 : 1;
		let multiMessagesNeeded = Math.ceil(amount / increment);
		let chunksNeeded = Math.ceil(multiMessagesNeeded / maximumMultipleChildren);

		for (let i = 0; i < chunksNeeded; i++) {
			console.log(`Progress: ${i * increment * maximumMultipleChildren} / ${amount}`);
			await new Promise(p => setTimeout(p, 50));

			this.coordinator.sendMessage(
				this.appID,
				this.protobufs.data.tf2.EGCItemMsg.k_EMsgGC_IncrementKillCountAttribute_Multiple,
				{},
				this.protobufs.encodeProto("CMsgIncrementKillCountAttribute_Multiple", {
					msgs: new Array(Math.min(maximumMultipleChildren, multiMessagesNeeded - (i * maximumMultipleChildren))).fill(0).map((_, j) => {
						let data = {
							killer_steam_id: killerID64,
							victim_steam_id: victimID64,
							item_id: itemID,
							event_type: eventType
						};
						if (eventTypeInfo?.allowIncrement) {
							data.increment_value = Math.min(increment, amount - (j * increment));
						}
						return data;
					})
				})
			);
		}

		// We are done! Final progress log (Its not truly calculated so if the above math is wrong this will be wrong too, lets hope I am smart)
		console.log(`Progress: ${amount} / ${amount}`);
	}

	upgradeMerasmusLevel(player, level) {
		return this.coordinator.sendMessage(
			this.appID,
			this.protobufs.data.tf2.ETFGCMsg.k_EMsgGC_Halloween_UpdateMerasmusLootLevel,
			{},
			this.protobufs.encodeProto("CMsgUpdateHalloweenMerasmusLootLevel", {
				merasmus_level: level,
				players: [
					{
						steam_id: new SteamID(player.toString()).getSteamID64()
					}
				]
			})
		);
	}
}
