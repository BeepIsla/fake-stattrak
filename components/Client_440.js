const ClientShared = require("./Client_Shared.js");

module.exports = class TF2Client extends ClientShared {
	constructor() {
		super(440);
	}

	login(username, password) {
		return new Promise(async (resolve, reject) => {
			try {
				let data = await super.login(username, password);

				// Finalizing
				await this.coordinator.sendMessage(
					440,
					this.protobufs.data.tf2.ETFGCMsg.k_EMsgGC_TFClientInit,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgTFClientInit", {
						client_version: this.clientVersion,
						language: 0
					})
				);

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

				// Done
				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}
}
