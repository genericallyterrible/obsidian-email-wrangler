import { Credentials, OAuth2Client } from "google-auth-library";

import http from "http";
import { URL } from "url";
import open from "open";
import enableDestroy from "server-destroy";
import EmailWranglerPlugin from "main";
import { AddressInfo } from "net";

const time_units = {
	milisceond: 1,
	second: 1_000,
	minute: 60_000,
	hour: 3_600_000,
};

function isAddressInfo(addr: string | AddressInfo | null): addr is AddressInfo {
	return (addr as AddressInfo).port !== undefined;
}

function getCredentialsFromSettings(plugin: EmailWranglerPlugin): Credentials {
	const credentials: Credentials = {
		refresh_token: plugin.settings.refresh_token,
		scope: plugin.settings.scope?.join(" "),
		token_type: "Bearer",
	};

	if (plugin.settings.access_token && plugin.settings.expiry_date) {
		credentials.access_token = plugin.settings.access_token;
		credentials.expiry_date = plugin.settings.expiry_date;
	}

	return credentials;
}

async function saveCredentialsToSettings(
	plugin: EmailWranglerPlugin,
	credentials: Credentials,
) {
	plugin.settings.scope = credentials.scope?.split(" ");
	plugin.settings.refresh_token = credentials.refresh_token;
	plugin.settings.access_token = credentials.access_token;
	plugin.settings.expiry_date = credentials.expiry_date;
	await plugin.saveSettings();
}

function makeOneShotServer(
	requestCallback: (request: http.IncomingMessage) => Promise<any>,
) {
	const server = http.createServer(async (request, response) => {
		try {
			const resp = await requestCallback(request);
			response.end(resp);
		} catch (e) {
			response.end("Encountered unexpected error");
			console.error(e);
		} finally {
			server.destroy();
		}
	});

	enableDestroy(server);
	return server;
}

function getOAuthClient(
	client_id: string,
	client_secret: string,
	scopes: string[] | undefined,
	login_hint?: string,
): Promise<OAuth2Client> {
	return new Promise((resolve, reject) => {
		let client: OAuth2Client;
		let shutdownTimer: NodeJS.Timeout;

		const redirect_uri = new URL("http://localhost");

		const server = makeOneShotServer(async (request) => {
			clearTimeout(shutdownTimer);

			if (!request.url) {
				const err = new Error("No callback URL provided");
				reject(err);
				return err.message;
			}

			const url = new URL(request.url, redirect_uri);

			const searchParams = url.searchParams;
			if (searchParams.has("error")) {
				const err = new Error(searchParams.get("error")!);
				reject(err);
				return err.message;
			}

			if (!searchParams.has("code")) {
				const err = new Error("No authentication code provided");
				reject(err);
				return err.message;
			}

			const { tokens } = await client.getToken({
				code: searchParams.get("code")!,
				redirect_uri: redirect_uri.toString(),
			});
			client.setCredentials(tokens);

			resolve(client);
			return "Authentication successful! Please return to Obsidian.";
		});

		// Any open port will do
		server.listen(0, () => {
			try {
				const address = server.address();
				if (isAddressInfo(address)) {
					// Update the uri with the server's port
					redirect_uri.port = String(address.port);
				}

				client = new OAuth2Client({
					clientId: client_id,
					clientSecret: client_secret,
					redirectUri: redirect_uri.toString(),
				});

				const authorize_url = client.generateAuthUrl({
					access_type: "offline",
					scope: scopes?.join(" "),
					login_hint: login_hint,
				});

				// Open the browser to the authorize url to start the OAuth workflow
				open(authorize_url, { wait: false }).then((child) => child.unref());

				// Spawn a timeout to shut down the server if no response
				// is received in some ammount of time
				shutdownTimer = setTimeout(() => {
					try {
						server.destroy();
					} catch (e) {
						console.error(e);
					} finally {
						reject(new Error("OAuth timed out."));
					}
				}, 30 * time_units.second);
			} catch (e) {
				clearTimeout(shutdownTimer);
				server.destroy();
				reject(e);
			}
		});
	});
}

async function getNewAuthClient(plugin: EmailWranglerPlugin): Promise<OAuth2Client> {
	const oAuth2Client = await getOAuthClient(
		plugin.settings.client_id,
		plugin.settings.client_secret,
		plugin.settings.scope,
		plugin.settings.associated_email,
	);

	await saveCredentialsToSettings(plugin, oAuth2Client.credentials);
	return oAuth2Client;
}

async function refreshAuthClient(plugin: EmailWranglerPlugin): Promise<OAuth2Client> {
	const oAuth2Client = new OAuth2Client({
		clientId: plugin.settings.client_id,
		clientSecret: plugin.settings.client_secret,
	});

	const credentials = getCredentialsFromSettings(plugin);
	oAuth2Client.setCredentials(credentials);

	const { token, res } = await oAuth2Client.getAccessToken();

	if (!token) {
		throw new Error("Failed to retrieve access token");
	}

	if (token == plugin.settings.access_token) {
		console.info("Access token reused");
	} else if (res) {
		const expiry_date: number | undefined = res.data?.expiry_date;

		if (!expiry_date) {
			throw new Error("Failed to retrieve access token expiry date");
		}

		credentials.access_token = token;
		credentials.expiry_date = expiry_date;
		oAuth2Client.setCredentials(credentials);
		await saveCredentialsToSettings(plugin, credentials);
		console.info("Access token refreshed");
	}

	return oAuth2Client;
}

export function invalidateAuthenticationClient(plugin: EmailWranglerPlugin) {
	plugin.settings.refresh_token = null;
}

export async function getAuthenticationClient(
	plugin: EmailWranglerPlugin,
): Promise<OAuth2Client> {
	if (!plugin.settings.refresh_token) {
		return getNewAuthClient(plugin);
	} else {
		return refreshAuthClient(plugin);
	}
}
