const SteamID = require("steamid");
const ServerShared = require("./Server_Shared.js");
const EventTypes = require("../helpers/EventTypes.js");

module.exports = class CSGOServer extends ServerShared {
	constructor(map = "de_dust2", serverName = "Development Test Server") {
		super(730, map, serverName);

		this.map = map;
	}

	login() {
		return new Promise(async (resolve, reject) => {
			try {
				let data = await super.login();

				// Finalizing
				await this.coordinator.sendMessage(
					730,
					this.protobufs.data.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingServerReservationResponse,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgGCCStrike15_v2_MatchmakingServerReservationResponse", {
						map: "de_dust2",
						server_version: this.serverVersion
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
					730,
					this.protobufs.data.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_Server2GCClientValidate,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgGCCStrike15_v2_Server2GCClientValidate", {
						accountid: steamID.accountid
					})
				);

				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}

	async incrementKillCountAttribute(killerID, victimID, itemID, eventType, amount) {
		let eventTypeInfo = EventTypes[730]?.[eventType];
		let maximumMultiSendAtOnce = 100; // CSGO doesn't support multi-messages but we can send multiple GC messages at once
		let increment = eventTypeInfo?.allowIncrement ? 1_000 : 1;
		let multiSendsNeeded = Math.ceil(amount / increment);
		let chunksNeeded = Math.ceil(multiSendsNeeded / maximumMultiSendAtOnce);

		// We send 10K at once
		for (let i = 0; i < chunksNeeded; i ++) {
			console.log(`Progress: ${i * increment * maximumMultiSendAtOnce} / ${amount}`);
			await new Promise(p => setTimeout(p, 50));

			let sendAtOnce = Math.min(maximumMultiSendAtOnce, multiSendsNeeded - (i * maximumMultiSendAtOnce));
			for (let j = 0; j < sendAtOnce; j++) {
				let data = {
					killer_account_id: killerID.accountid,
					victim_account_id: victimID.accountid,
					item_id: itemID,
					event_type: eventType,
					amount: Math.min(increment, amount - (j * increment))
				};
				this.coordinator.sendMessage(
					this.appID,
					this.protobufs.data.csgo.EGCItemMsg.k_EMsgGC_IncrementKillCountAttribute,
					{},
					this.protobufs.encodeProto("CMsgIncrementKillCountAttribute", data)
				);
			}
		}

		// We are done! Final progress log (Its not truly calculated so if the above math is wrong this will be wrong too, lets hope I am smart)
		console.log(`Progress: ${amount} / ${amount}`);
	}
}
