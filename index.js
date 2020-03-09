const config = require("./config.json");
const Helper = require("./helpers/Helper.js");
const allowedAppIDs = [440, 730];

(async () => {
	if (!allowedAppIDs.includes(Number(config.appID))) {
		console.log("Only supported app IDs are[" + allowedAppIDs.join(", ") + "]");
		return;
	}

	console.log("Validating protobufs...");
	if (!Helper.verifyProtobufs()) {
		console.log("Failed to find protobufs, downloading...");
		await Helper.downloadProtobufs(__dirname).catch((err) => {
			console.error(err);
		});

		if (!Helper.verifyProtobufs()) {
			console.log("Failed to download protobufs.");
			return;
		}
	} else {
		console.log("Found protobufs!");
	}

	console.log("Requiring files for appID " + config.appID);
	let Server = require("./components/Server_" + config.appID + ".js");
	let Client = require("./components/Client_" + config.appID + ".js");

	console.log("Creating constructors...");
	let server = new Server();
	let clients = [
		new Client(),
		new Client()
	];

	console.log("Logging into Steam as client and server...");
	await clients[1].login(config.boostingAccount.username, config.boostingAccount.password); // Log onto main first cuz SteamGuard
	let resolveds = await Promise.all([
		clients[0].login(config.botAccount.username, config.botAccount.password),
		server.login()
	]);
	let serverID = resolveds[1];

	console.log("Successfully logged into Steam and signed up as bot account as " + clients[0].steamID.getSteamID64());
	console.log("Successfully logged into Steam and signed up as main account as " + clients[1].steamID.getSteamID64());
	console.log("Successfully logged into Steam and signed up as server as " + server.steamID.getSteamID64());

	for (let i = 0; i < clients.length; i++) {
		let ticket = await clients[i].generateTicket();
		console.log("Fake joining server with bot account " + clients[i].steamID.getSteamID64() + "...");
		await server.addPlayer(clients[i].steamID, ticket);
		console.log("Successfully added player to server, verifying on client...");
		await clients[i].joinServer(serverID, ticket);
		console.log("Successfully connected client and server!");
	}

	// A little delay just to make sure its all set and data has been received
	await new Promise(p => setTimeout(p, 2000));

	server.incrementKillCountAttribute(clients[1].steamID, clients[0].steamID, config.itemID, config.eventType, config.incrementValue, config.repeat);
	console.log("Item increments are now being processed by Valve, this may take a little bit or until log-off.");

	console.log("Logging off in 10 seconds...");
	setTimeout(() => {
		server.logOff();
		clients.forEach(c => c.logOff());

		console.log("Successfully logged off");
		setTimeout(process.exit, 5000, 0).unref();
	}, 10 * 1000);
})();
