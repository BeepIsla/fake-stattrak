const path = require("path");
const fs = require("fs");
const URL = require("url");
const unzipper = require("unzipper");
const Protobufs = require("./Protobufs.js");

module.exports = class Helper {
	static async GetSteamAPI(interf, method, version, params) {
		let json = await this.getJSON("https://api.steampowered.com/" + interf + "/" + method + "/" + version, params);
		return json.response;
	}

	static async getJSON(url, qs) {
		let uri = new URL.URL(url);
		for (let key in qs) {
			uri.searchParams.append(key, qs[key]);
		}

		let res = await fetch(uri.href);
		return await res.json();
	}

	static async downloadProtobufs(dir) {
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
		let res = await fetch("https://github.com/SteamDatabase/Protobufs/archive/master.zip");
		let buf = Buffer.from(await res.arrayBuffer());

		let zip = await unzipper.Open.buffer(buf);
		await zip.extract({
			path: dir
		});

		fs.renameSync(newProDir, proDir);
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