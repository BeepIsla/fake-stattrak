const path = require("path");
const Events = require("events");
const SteamUser = require("steam-user");
const StdLib = require("@doctormckay/stdlib");
const Protobufs = require("../helpers/Protobufs.js");
const Coordinator = require("../helpers/Coordinator.js");
const Helper = require("../helpers/Helper.js");
const validAppIDs = [440, 730];
const appIdProtobufs = {
	"440": {
		name: "tf2",
		protos: path.join(__dirname, "..", "protobufs", "tf2")
	},
	"730": {
		name: "csgo",
		protos: path.join(__dirname, "..", "protobufs", "csgo")
	}
};
const versionNiceAppIdParser = {
	"440": function (version) {
		return version;
	},
	"730": function (verion) {
		return verion[0] + "." + verion[1] + verion[2] + "." + verion[3] + "." + verion[4];
	}
};

module.exports = class ClientShared extends Events {
	constructor(appID) {
		super();

		if (!validAppIDs.includes(appID)) {
			throw new Error("Shared server structure not setup to support app ID " + appID);
		}
		this.appID = appID;

		this.protobufs = new Protobufs([
			{
				name: "steam",
				protos: path.join(__dirname, "..", "protobufs", "steam")
			},
			appIdProtobufs[this.appID]
		]);

		this.client = new SteamUser();
		this.coordinator = new Coordinator(this.client, this.appID);

		this.coordinator.on("receivedFromSteam", this._receivedFromSteam.bind(this));
		this.coordinator.on("receivedFromGC", this._receivedFromGameCoordinator.bind(this));

		this.clientVersion = 0;
		this.clientVersionNice = 0;

		this.serverInfo = null;
		this.gcWelcome = null;
	}

	get steamID() {
		return this.client.steamID;
	}

	login(username, password) {
		return new Promise(async (resolve, reject) => {
			try {
				let version = await Helper.GetSteamAPI("ISteamApps", "UpToDateCheck", "v1", {
					appid: this.appID,
					version: 0
				});
				if (!version.success) {
					reject(new Error(version));
					return;
				}
				this.clientVersion = String(version.required_version);
				this.clientVersionNice = versionNiceAppIdParser[this.appID](this.clientVersion);
				this.clientVersion = Number(this.clientVersion);

				// Login
				this.client.logOn({
					accountName: username,
					password: password
				});

				await new Promise((res, rej) => {
					this.client.on("loggedOn", (details) => {
						res();
					});
					this.client.on("error", (err) => {
						rej(err);
					});
				}).finally(() => {
					this.client.removeAllListeners("loggedOn");
					this.client.removeAllListeners("error");
				});

				// Get license and set as online & playing
				await this.client.requestFreeLicense([this.appID]);
				this.client.setPersona(SteamUser.EPersonaState.Online);
				this.client.gamesPlayed({
					game_id: this.appID
				});

				// GC register
				let welcomeFails = 0;
				let welcome = null;
				while (!welcome) {
					welcome = await this.coordinator.sendMessage(
						this.appID,
						4006, // Always "4006"
						{},
						this.protobufs.encodeProto("CMsgClientHello", {}),
						4004, // Always "4004"
						5000
					).catch(() => { });

					if (++welcomeFails >= 12 && !welcome) {
						reject(new Error("Failed to connect to Steam"));
						this.logOff();
						return;
					}
				}
				welcome = welcome instanceof Buffer ? this.protobufs.decodeProto("CMsgClientWelcome", welcome) : welcome;
				this.gcWelcome = welcome;

				// Done
				resolve(true);
			} catch (err) {
				this.logOff();
				reject(err);
			}
		});
	}

	_receivedFromSteam(header, body) {
		let decoder = "";
		switch (header.msg) {
			default: {
				break;
			}
		}

		if (!decoder) {
			return;
		}

		let obj = this.protobufs.decodeProto(decoder, body);
		switch (header.msg) {
			default: {
				break;
			}
		}
	}

	_receivedFromGameCoordinator(msgType, body) {
		let decoder = "";
		switch (msgType) {
			default: {
				break;
			}
		}

		if (!decoder) {
			return;
		}

		let obj = this.protobufs.decodeProto(decoder, body);
		switch (msgType) {
			default: {
				break;
			}
		}
	}

	logOff() {
		this.client.logOff();

		this.clientVersion = 0;
		this.clientVersionNice = 0;

		this.serverInfo = null;
		this.gcWelcome = null;
	}

	async generateTicket() {
		let authTicket = await this.client.getAuthSessionTicket(this.appID);
		return authTicket.appTicket;
	}

	joinServer(serverID, appTicket) {
		return new Promise(async (resolve, reject) => {
			try {
				let serverInfoFails = 0;
				this.serverInfo = null;
				while (!this.serverInfo) {
					let servers = await this.client.getServerList("\\steamid\\" + serverID + "\\", 10);
					this.serverInfo = servers.servers ? servers.servers[0] : undefined;

					if (++serverInfoFails >= 10 && !this.serverInfo) {
						reject(new Error("Failed to fetch server information"));
						return;
					} else if (!this.serverInfo) {
						await new Promise(p => setTimeout(p, 5000));
					}
				}

				let ticketCrc = StdLib.Hashing.crc32(appTicket);

				let authList = await this.coordinator.sendMessage(
					undefined,
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthList, // Do not encode protobuf below like usually, Steam-User automatically does this for us
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					}, {
						tokens_left: this.client._gcTokens.length,
						last_request_seq: this.client._authSeqMe,
						last_request_seq_from_server: this.client._authSeqThem,
						tickets: [
							{
								estate: 0,
								eresult: 4294967295,
								steamid: 0,
								gameid: this.appID,
								h_steam_pipe: this.client._hSteamPipe,
								ticket_crc: ticketCrc,
								ticket: appTicket
							}
						],
						app_ids: [
							this.appID
						],
						message_sequence: ++this.client._authSeqMe
					},
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthListAck,
					5000
				);
				authList = authList instanceof Buffer ? this.protobufs.decodeProto("CMsgClientAuthListAck", authList) : authList;

				this.client.gamesPlayed({
					steam_id_gs: serverID,
					game_id: this.appID
				});

				resolve(true);
			} catch (err) {
				reject(err);
			}
		});
	}

	leaveServer() {
		return new Promise(async (resolve, reject) => {
			try {
				await this.coordinator.sendMessage(
					undefined,
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthList, // Do not encode protobuf below like usually, Steam-User automatically does this for us
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgClientAuthList", {
						tokens_left: this.client._gcTokens.length,
						last_request_seq: this.client._authSeqMe,
						last_request_seq_from_server: this.client._authSeqThem,
						app_ids: [
							this.appID
						],
						message_sequence: ++this.client._authSeqMe
					}),
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthListAck,
					5000
				);

				this.client.gamesPlayed({
					game_id: this.appID
				});

				resolve();
			} catch (err) {
				reject(err);
			}
		});
	}
}
