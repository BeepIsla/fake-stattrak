const config = require("./config.json");
const Helper = require("./helpers/Helper.js");
const EventTypes = require("./helpers/EventTypes.js");
const allowedAppIDs = [440, 730];

(async () => {
	if (!allowedAppIDs.includes(Number(config.appID))) {
		console.log("Only supported app IDs are " + allowedAppIDs.join(", "));
		return;
	}

	if (typeof config.repeat === "number" || typeof config.incrementValue !== "number") {
		console.log("Error: Invalid config detected.");
		console.log("Please read the README for up-to-date information: https://github.com/BeepIsla/fake-stattrak");
		console.log("");
		console.log("The 'repeat' value is no longer supported.");
		console.log("Using 'null' for 'incrementValue' is no longer supported.");
		console.log("This script now attempts to automatically calculate the 'repeat' value, you do not need it in your config anymore.");
		console.log("Please remove 'repeat' from your config and set 'incrementValue' to a valid number.");
		return;
	}

	let eventTypeInfo = EventTypes[config.appID]?.[config.eventType];
	if (!eventTypeInfo) {
		console.log(`Unknown event type ${config.eventType} for app ${config.appID}`);
		return;
	}

	if (eventTypeInfo.officialOnly) {
		console.log(`Event type "${eventTypeInfo.name}" (${eventTypeInfo.internal}) can only be increased on Official Valve Servers`);
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

	console.log("Logging into main account...");
	await clients[1].login(config.boostingAccount.username, config.boostingAccount.password); // Log onto main first cuz SteamGuard
	console.log("Successfully logged into Steam and signed up as main account as " + clients[1].steamID.getSteamID64());

	console.log("Logging into Steam with bot and as server...");
	let resolveds = await Promise.all([
		clients[0].login(config.botAccount.username, config.botAccount.password),
		server.login()
	]);
	let serverID = resolveds[1];
	console.log("Successfully logged into Steam and signed up as bot account as " + clients[0].steamID.getSteamID64());
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
	await new Promise(p => setTimeout(p, 1000));

	await server.incrementKillCountAttribute(clients[1].steamID, clients[0].steamID, config.itemID, config.eventType, config.incrementValue);
	console.log("Item increments are now being processed by Valve. Depending on how much you incremented your item by this can take a while.");
	console.log("It is not guaranteed that all increments will get processed by the end of this delay.");
	console.log("Your inventory may be inaccessible for a few minutes.");

	// Random number: 2s per 50K (1M = 40s)
	let secondDelay = 2 * Math.ceil(config.incrementValue / 50_000);

	console.log(`Logging off in ${secondDelay} seconds... (You can exit early by closing the command prompt)`);
	setTimeout(() => {
		server.logOff();
		clients.forEach(c => c.logOff());

		console.log("Successfully logged off");

		// Something somewhere keeps the event loop alive and we never exit. So we just kill the process after a bit
		setTimeout(process.exit, 5000, 0).unref();
	}, secondDelay * 1000);
})();
