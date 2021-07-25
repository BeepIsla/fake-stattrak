const SteamID = require("steamid");
const ServerShared = require("./Server_Shared.js");

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

	incrementKillCountAttribute(killerID, victimID, itemID, eventType, amount, repeat) {
		if (typeof amount !== "number" || amount <= 0) {
			amount = 1;
		}

		return this.coordinator.sendMessage(
			this.appID,
			this.protobufs.data.csgo.EGCItemMsg.k_EMsgGC_IncrementKillCountAttribute,
			{},
			this.protobufs.encodeProto("CMsgIncrementKillCountAttribute", {
				killer_account_id: killerID.accountid,
				victim_account_id: victimID.accountid,

				item_id: itemID,
				event_type: eventType,

				amount: amount * repeat
			})
		);
	}
}
