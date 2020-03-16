const StdLib = require("@doctormckay/stdlib");
const ClientShared = require("./Client_Shared.js");

module.exports = class CSGOClient extends ClientShared {
	constructor() {
		super(730);
	}

	login(username, password) {
		return new Promise(async (resolve, reject) => {
			try {
				let data = await super.login(username, password);

				// Finalizing
				let mmWelcome = await this.coordinator.sendMessage(
					730,
					this.protobufs.data.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingClient2GCHello,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgGCCStrike15_v2_MatchmakingClient2GCHello", {}),
					this.protobufs.data.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
					5000
				);
				mmWelcome = mmWelcome instanceof Buffer ? this.protobufs.decodeProto("CMsgGCCStrike15_v2_MatchmakingGC2ClientHello", mmWelcome) : mmWelcome;
				this.mmWelcome = mmWelcome;

				// Done
				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}

	joinServer(serverID, appTicket) {
		return new Promise(async (resolve, reject) => {
			try {
				let serverInfoFails = 0;
				let serverInfo = null;
				while (!serverInfo) {
					let servers = await this.client.getServerList("\\steamid\\" + serverID + "\\", 10);
					serverInfo = servers.servers ? servers.servers[0] : undefined;

					if (++serverInfoFails >= 10 && !serverInfo) {
						reject(new Error("Failed to fetch server information"));
						return;
					} else if (!serverInfo) {
						await new Promise(p => setTimeout(p, 5000));
					}
				}

				let serverIP = serverInfo.addr.split(":").shift();
				let serverPort = serverInfo.addr.split(":").pop();

				await this.coordinator.sendMessage(
					730,
					this.protobufs.data.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientRequestJoinServerData,
					{},
					this.protobufs.encodeProto("CMsgGCCStrike15_v2_ClientRequestJoinServerData", {
						version: this.clientVersion,
						account_id: this.steamID.accountid,
						serverid: serverID,
						server_ip: StdLib.IPv4.stringToInt(serverIP),
						server_port: serverPort
					})
				);

				let data = await super.joinServer(serverID, appTicket);
				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}
}
