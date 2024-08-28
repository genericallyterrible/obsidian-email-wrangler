import http from "http";
import { AddressInfo } from "net";
import { URL } from "url";
import { Credentials, OAuth2Client } from "google-auth-library";
import EmailWranglerPlugin from "main";
import open from "open";
import enableDestroy from "server-destroy";
import { time_units } from "utils/units";

function isAddressInfo(addr: string | AddressInfo | null): addr is AddressInfo {
	return (addr as AddressInfo).port !== undefined;
}

function getCredentialsFromSettings(plugin: EmailWranglerPlugin): Credentials {
	const credentials: Credentials = {
		refresh_token: plugin.settings.refresh_token,
		scope: plugin.settings.scope?.join(" "),
		token_type: "Bearer",
	};

	return credentials;
}

async function saveCredentialsToSettings(
	plugin: EmailWranglerPlugin,
	credentials: Credentials,
) {
	plugin.settings.scope = credentials.scope?.split(" ");
	plugin.settings.refresh_token = credentials.refresh_token;
	await plugin.saveSettings();
}

function makeOneShotServer(
	requestCallback: (request: http.IncomingMessage) => Promise<unknown>,
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
			const param_err = searchParams.get("error");
			if (param_err) {
				const err = new Error(param_err);
				reject(err);
				return err.message;
			}

			const code = searchParams.get("code");
			if (!code) {
				const err = new Error("No authentication code provided");
				reject(err);
				return err.message;
			}

			const { tokens } = await client.getToken({
				code: code,
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

export function invalidateAuthenticationClient(plugin: EmailWranglerPlugin) {
	plugin.settings.refresh_token = null;
}

export async function getAuthenticationClient(
	plugin: EmailWranglerPlugin,
): Promise<OAuth2Client> {
	if (!plugin.settings.refresh_token) {
		return getNewAuthClient(plugin);
	} else {
		const oAuth2Client = new OAuth2Client({
			clientId: plugin.settings.client_id,
			clientSecret: plugin.settings.client_secret,
		});
		const credentials = getCredentialsFromSettings(plugin);
		oAuth2Client.setCredentials(credentials);
		return oAuth2Client;
	}
}
