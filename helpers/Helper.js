const path = require("path");
const fs = require("fs");
const request = require("request");
const Protobufs = require("./Protobufs.js");

module.exports = class Helper {
	static async GetSteamAPI(interf, method, version, params) {
		let json = await this.getJSON({
			url: "https://api.steampowered.com/" + interf + "/" + method + "/" + version,
			qs: params
		});
		return json.response;
	}

	static getJSON(opts) {
		return new Promise((resolve, reject) => {
			request(opts, (err, res, body) => {
				if (err) {
					reject(err);
					return;
				}

				try {
					let json = JSON.parse(body);
					resolve(json);
				} catch (err) {
					reject(body);
				}
			});
		});
	}

	static downloadProtobufs(dir) {
		return new Promise(async (resolve, reject) => {
			let deletes = ["Protobufs-master", "protobufs"];
			await Promise.all(deletes.map(d => {
				let p = path.join(dir, d);
				if (fs.existsSync(p)) {
					return this.deleteRecursive(p);
				} else {
					return new Promise(r => r());
				}
			}));

			let newProDir = path.join(dir, "Protobufs-master");
			let proDir = path.join(dir, "protobufs");

			// Yes I know the ones I download here are technically not the same as the ones in the submodule
			// but that doesn't really matter, I doubt Valve will do any major changes with the protobufs I use here anyways
			request({
				uri: "https://github.com/SteamDatabase/Protobufs/archive/master.zip",
				encoding: null
			}, async (err, res, body) => {
				if (err) {
					reject(err);
					return;
				}

				let zip = await unzipper.Open.buffer(body);
				await zip.extract({
					path: dir
				});

				fs.rename(newProDir, proDir, (err) => {
					if (err) {
						reject(err);
						return;
					}

					resolve();
				});
			});
		});
	}

	static verifyProtobufs() {
		try {
			// Not a full verification, constructors are all missing but whatever
			let protobufs = new Protobufs([
				{
					name: "steam",
					protos: [
						path.join(__dirname, "..", "protobufs", "steam", "enums_clientserver.proto")
					]
				},
				{
					name: "tf2",
					protos: [
						path.join(__dirname, "..", "protobufs", "tf2", "tf_gcmessages.proto"),
						path.join(__dirname, "..", "protobufs", "tf2", "gcsystemmsgs.proto"),
						path.join(__dirname, "..", "protobufs", "tf2", "econ_gcmessages.proto")
					]
				},
				{
					name: "csgo",
					protos: [
						path.join(__dirname, "..", "protobufs", "csgo", "cstrike15_gcmessages.proto"),
						path.join(__dirname, "..", "protobufs", "csgo", "econ_gcmessages.proto"),
						path.join(__dirname, "..", "protobufs", "csgo", "gcsystemmsgs.proto")
					]
				}
			]);
			let verification = {
				"steam": {
					"EMsg": [
						"k_EMsgClientAuthList",
						"k_EMsgClientAuthListAck",
						"k_EMsgGSServerType",
						"k_EMsgGSStatusReply",
						"k_EMsgClientConnectionStats",
						"k_EMsgAMGameServerUpdate",
						"k_EMsgGameServerOutOfDate"
					]
				},
				"tf2": {
					"ETFGCMsg": [
						"k_EMsgGC_TFClientInit",
						"k_EMsgGC_GameServer_LevelInfo"
					],
					"ESOMsg": [
						"k_ESOMsg_CacheSubscriptionRefresh"
					],
					"EGCItemMsg": [
						"k_EMsgGC_IncrementKillCountAttribute_Multiple"
					],
					"EGCBaseClientMsg": [
						"k_EMsgGCClientHello",
						"k_EMsgGCClientWelcome",
						"k_EMsgGCServerHello"
					]
				},
				"csgo": {
					"ECsgoGCMsg": [
						"k_EMsgGCCStrike15_v2_MatchmakingClient2GCHello",
						"k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello",
						"k_EMsgGCCStrike15_v2_ClientRequestJoinServerData",
						"k_EMsgGCCStrike15_v2_MatchmakingServerReservationResponse",
						"k_EMsgGCCStrike15_v2_Server2GCClientValidate",
						"k_EMsgGCCStrike15_v2_MatchEndRunRewardDrops"
					],
					"EGCItemMsg": [
						"k_EMsgGC_IncrementKillCountAttribute"
					],
					"EGCBaseClientMsg": [
						"k_EMsgGCClientHello",
						"k_EMsgGCClientWelcome",
						"k_EMsgGCServerHello"
					]
				}
			};

			for (let type in verification) {
				for (let key in verification[type]) {
					for (let msg of verification[type][key]) {
						if (typeof protobufs.data[type][key][msg] === "number") {
							continue;
						}

						return false;
					}
				}
			}

			return true;
		} catch (e) {
			return false;
		}
	}

	static deleteRecursive(dir) {
		return new Promise((resolve, reject) => {
			fs.readdir(dir, async (err, files) => {
				if (err) {
					reject(err);
					return;
				}

				for (let file of files) {
					let filePath = path.join(dir, file);
					let stat = fs.statSync(filePath);

					if (stat.isDirectory()) {
						await this.deleteRecursive(filePath);
					} else {
						await new Promise((res, rej) => {
							fs.unlink(filePath, (err) => {
								if (err) {
									rej(err);
									return;
								}

								res();
							});
						});
					}
				}

				fs.rmdir(dir, (err) => {
					if (err) {
						reject(err);
						return;
					}

					resolve();
				});
			});
		});
	}
}