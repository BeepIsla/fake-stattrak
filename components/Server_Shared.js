const path = require("path");
const Events = require("events");
const SteamUser = require("steam-user");
const SteamID = require("steamid");
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
const appIdDir = {
	"440": "tf",
	"730": "csgo"
};
const appIdGCHello = {
	"440": {
		version: 1077,
	},
	"730": {
		version: 1077,
		client_launcher: 0,
	}
};
const appIdGameData = {
	"440": "tf_mm_trusted:0,tf_mm_servermode:0,lobby:0,steamblocking:0",
	"730": "g:csgo,gt:0,gm:1,sk:0,f1:0,"
};
const appIdGcWelcomeDecode = {
	"440": "CMsgServerWelcome",
	"730": "CMsgClientWelcome"
};

module.exports = class ServerShared extends Events {
	constructor(appID, map = "itemtest", serverName = "Development Test Server") {
		super();

		if (!validAppIDs.includes(appID)) {
			throw new Error("Shared server structure not setup to support app ID " + appID);
		}
		this.appID = appID;
		this.map = map;
		this.serverName = serverName;

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

		this.serverVersion = 0;
		this.serverVersionNice = "";

		this.gcWelcome = null;
		this.lastServerUpdate = null;
		this.players = [];
		this.loggedOff = false;
	}

	get steamID() {
		return this.client.steamID;
	}

	login() {
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
				this.serverVersion = String(version.required_version);
				this.serverVersionNice = versionNiceAppIdParser[this.appID](this.serverVersion);
				this.serverVersion = Number(this.serverVersion);

				// Login
				this.client._logOnDetails = {
					_steamid: "90071992547409920", // Anon gameserver

					protocol_version: 65580,
					obfustucated_private_ip: 2130706433,
					cell_id: 4294967295,
					client_os_type: 10,
					qos_level: 2,
					is_steam_box: false,
					client_instance_id: 0
				};
				this.client.logOn(true);

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

				// Register server
				let data = await this.coordinator.sendMessage(
					undefined,
					this.protobufs.data.steam.EMsg.k_EMsgGSServerType,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgGSServerType", {
						app_id_served: this.appID,
						flags: 6,
						game_port: 27015,
						game_dir: appIdDir[this.appID],
						game_version: this.serverVersionNice,
						game_query_port: 27015
					}),
					this.protobufs.data.steam.EMsg.k_EMsgGSStatusReply,
					10000
				);
				data = data instanceof Buffer ? this.protobufs.decodeProto("CMsgGSStatusReply", data) : data;
				if (!data.is_secure) {
					reject(new Error("\"is_secure\": \"" + data.is_secure + "\" | Expected \"true\""));
					this.logOff();
					return;
				}

				await this.coordinator.sendMessage(
					undefined,
					this.protobufs.data.steam.EMsg.k_EMsgClientConnectionStats,
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgClientConnectionStats", {
						stats_logon: {
							connect_attempts: 1,
							connect_successes: 1,
							connect_failures: 0,
							connections_dropped: 0,
							seconds_running: 14,
							msec_tologonthistime: 12881,
							count_bad_cms: 0
						},
						stats_vconn: {
							connections_udp: 0,
							connections_tcp: 5,
							stats_udp: {
								pkts_sent: 2,
								bytes_sent: 8,
								pkts_recv: 0,
								pkts_processed: 0,
								bytes_recv: 0
							},
							pkts_abandoned: 0,
							conn_req_received: 0,
							pkts_resent: 0,
							msgs_sent: 0,
							msgs_sent_failed: 0,
							msgs_recv: 0,
							datagrams_sent: 0,
							datagrams_recv: 0,
							bad_pkts_recv: 0,
							unknown_conn_pkts_recv: 0,
							missed_pkts_recv: 0,
							dup_pkts_recv: 0,
							failed_connect_challenges: 0,
							micro_sec_avg_latency: 0,
							micro_sec_min_latency: 0,
							micro_sec_max_latency: 0,
							mem_pool_msg_in_use: 0
						}
					})
				);

				this.loggedOff = false;

				this.sendServerUpdate({
					steam_id_gs: this.client.steamID.getSteamID64(),
					query_port: 27015,
					game_port: 27015,
					sourcetv_port: 0,
					name: this.serverName,
					app_id: this.appID,
					gamedir: appIdDir[this.appID],
					version: this.serverVersionNice,
					product: appIdDir[this.appID],
					region: "-1",
					max_players: 10,
					bot_count: 0,
					password: true,
					secure: true,
					dedicated: true,
					os: "w",
					game_data: appIdGameData[this.appID],
					game_data_version: 1,
					game_type: "empty,secure",
					map: this.map
				});

				// GC register
				let welcome = await this.coordinator.sendMessage(
					this.appID,
					4007, // Always 4007
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					this.protobufs.encodeProto("CMsgServerHello", appIdGCHello[this.appID]),
					4005, // Always 4005
					5000
				);
				welcome = welcome instanceof Buffer ? this.protobufs.decodeProto(appIdGcWelcomeDecode[this.appID], welcome) : welcome;
				this.gcWelcome = welcome;

				// Done
				resolve(this.steamID.getSteamID64());
			} catch (err) {
				this.logOff();
				reject(err);
			}
		});
	}

	sendServerUpdate(update) {
		if (this.loggedOff) {
			return false;
		}

		if (!update) {
			update = this.lastServerUpdate || {};
		}

		if (this.lastServerUpdate) {
			for (let key in this.lastServerUpdate) {
				if (typeof update[key] !== "undefined") {
					continue;
				}

				update[key] = this.lastServerUpdate[key];
			}
		}
		this.lastServerUpdate = update;

		return this.coordinator.sendMessage(
			undefined,
			this.protobufs.data.steam.EMsg.k_EMsgAMGameServerUpdate,
			{
				steamid: this.client.steamID.getSteamID64(),
				client_sessionid: this.client._sessionID
			},
			this.protobufs.encodeProto("CMsgGameServerData", update)
		);
	}

	_receivedFromSteam(header, body) {
		let decoder = "";
		switch (header.msg) {
			case this.protobufs.data.steam.EMsg.k_EMsgGameServerOutOfDate: {
				decoder = "CMsgGameServerOutOfDate";
				break;
			}
			default: {
				break;
			}
		}

		if (!decoder) {
			return;
		}

		let obj = this.protobufs.decodeProto(decoder, body);
		switch (header.msg) {
			case this.protobufs.data.steam.EMsg.k_EMsgGameServerOutOfDate: {
				this.emit("outOfDate", obj);
				break;
			}
			default: {
				break;
			}
		}
	}

	_receivedFromGameCoordinator(msgType, body) {
		let decoder = "";
		switch (msgType) {
			case 24: { // k_ESOMsg_CacheSubscribed
				decoder = "CMsgSOCacheSubscribed";
				break;
			}
			case 26: { // k_ESOMsg_UpdateMultiple
				decoder = "CMsgSOMultipleObjects";
				break;
			}
			case 25: { // k_ESOMsg_CacheUnsubscribed
				decoder = "CMsgSOCacheUnsubscribed";
				break;
			}
			default: {
				break;
			}
		}

		if (!decoder) {
			return;
		}

		let obj = this.protobufs.decodeProto(decoder, body);
		switch (msgType) {
			case 24: { // k_ESOMsg_CacheSubscribed
				this.emit("cacheSubscribed", obj);
				break;
			}
			case 26: { // k_ESOMsg_UpdateMultiple
				this.emit("cacheUpdateMultiple", obj);
				break;
			}
			case 25: { // k_ESOMsg_CacheUnsubscribed
				this.emit("cacheUnsubscribe", obj);
				break;
			}
			default: {
				break;
			}
		}
	}

	logOff() {
		this.client.logOff();

		this.serverVersion = 0;
		this.serverVersionNice = "";

		this.gcWelcome = null;
		this.lastServerUpdate = null;
		this.players = [];

		this.loggedOff = true;
	}

	addPlayer(steamID, appTicket) {
		return new Promise(async (resolve, reject) => {
			try {
				steamID = new SteamID(steamID.toString());
			} catch (err) {
				reject(err);
				return;
			}

			let playerIndex = this.players.length;
			try {
				// Add player 
				this.players.push({
					steamID: steamID,
					ticket: appTicket,
					ticketResponse: null,
					sessionId: null
				});

				// Verify user's well-being
				let verify = await this.coordinator.sendMessage(
					undefined,
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthList, // Do not encode protobuf below like usually, Steam-User automatically does this for us
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					}, {
					tokens_left: 0,
					last_request_seq: 0,
					last_request_seq_from_server: 0,
					tickets: this.players.map((player, index) => {
						let ticketCrc = StdLib.Hashing.crc32(player.ticket);
						return {
							estate: playerIndex === index ? 1 : 3,
							eresult: 4294967295,
							steamid: player.steamID.getSteamID64(),
							gameid: this.appID,
							h_steam_pipe: this.client._hSteamPipe,
							ticket_crc: ticketCrc,
							ticket: player.ticket
						};
					}),
					app_ids: [
						this.appID
					],
					message_sequence: ++this.client._authSeqMe
				},
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthListAck,
					5000
				);
				verify = verify instanceof Buffer ? this.protobufs.decodeProto("CMsgClientAuthListAck", verify) : verify;
				this.players[playerIndex].ticketResponse = verify;

				// Update server info
				await this.sendServerUpdate({
					players: this.players.map((player) => {
						return {
							steamid_id: player.steamID.getSteamID64()
						};
					}),
					game_data: appIdGameData[this.appID],
					game_data_version: 1,
					game_type: this.players.length <= 0 ? "empty,secure" : "secure"
				});

				resolve(true);
			} catch (err) {
				this.players.splice(playerIndex, 1);
				reject(err);
			}
		});
	}

	removePlayer(steamID) {
		return new Promise(async (resolve, reject) => {
			try {
				steamID = new SteamID(steamID.toString());
			} catch (err) {
				reject(err);
				return;
			}

			// Remove player
			let playerIndex = this.players.findIndex(p => p.steamID.accountid === steamID.accountid);
			this.players.splice(playerIndex, 1);


			try {
				// Unverify user
				let verify = await this.coordinator.sendMessage(
					undefined,
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthList, // Do not encode protobuf below like usually, Steam-User automatically does this for us
					{
						steamid: this.client.steamID.getSteamID64(),
						client_sessionid: this.client._sessionID
					},
					{
						tokens_left: this.client._gcTokens.length,
						last_request_seq: this.client._authSeqMe,
						last_request_seq_from_server: this.client._authSeqThem,
						tickets: this.players.map((player) => {
							let ticketCrc = StdLib.Hashing.crc32(player.ticket);
							return {
								estate: 1,
								eresult: 4294967295,
								steamid: player.steamID.getSteamID64(),
								gameid: this.appID,
								h_steam_pipe: this.client._hSteamPipe,
								ticket_crc: ticketCrc,
								ticket: player.ticket
							};
						}),
						app_ids: [
							this.appID
						],
						message_sequence: ++this.client._authSeqMe
					},
					this.protobufs.data.steam.EMsg.k_EMsgClientAuthListAck,
					5000
				);
				verify = verify instanceof Buffer ? this.protobufs.decodeProto("CMsgClientAuthListAck", verify) : verify;

				// Update server info
				await this.sendServerUpdate({
					players: this.players.map((player) => {
						return {
							steamid_id: player.steamID.getSteamID64()
						};
					}),
					game_data: appIdGameData[this.appID],
					game_data_version: 1,
					game_type: this.players.length <= 0 ? "empty,secure" : "secure"
				});

				resolve(true);
			} catch (err) {
				reject(err);
			}
		});
	}
}
