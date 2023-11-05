import { Credentials, OAuth2Client } from "google-auth-library";

import http from "http";
import url from "url";
import open from "open";
import enableDestroy from "server-destroy";
import EmailWranglerPlugin from "main";

function makeRedirectUri(host: string, port?: number): string {
	if (port) {
		return `${host}:${port}`;
	}
	return host;
}

function getOAuthCode(
	authorize_url: string,
	redirect_host: string,
	redirect_port: number,
): Promise<string> {
	const redirect_uri = makeRedirectUri(redirect_host, redirect_port);

	return new Promise((resolve, reject) => {
		let shutdownTimer: NodeJS.Timeout;

		const server = http.createServer(async (request, response) => {
			try {
				clearTimeout(shutdownTimer);

				if (!request.url) {
					throw new Error("Request did not contain 'url'");
				}

				// acquire the code from the querystring
				const params = new url.URL(request.url, redirect_uri).searchParams;
				const code = params.get("code");

				if (!code) {
					throw new Error("Request did not contain 'code' parameter");
				}

				response.end("Authentication successful! Please return to Obsidian.");
				resolve(code);
			} catch (e) {
				response.end(e);
				reject(e);
			} finally {
				server.destroy();
			}
		});

		enableDestroy(server);

		shutdownTimer = setTimeout(() => {
			console.log("OAuth timed out.");
			server.destroy();
		}, 30000);

		server.listen(redirect_port, () => {
			// open the browser to the authorize url to start the workflow
			try {
				open(authorize_url, { wait: false }).then((child) => child.unref());
			} catch (e) {
				clearTimeout(shutdownTimer);
				server.destroy();
				reject(e);
			}
		});
	});
}

export async function getNewAuthClient(plugin: EmailWranglerPlugin): Promise<OAuth2Client> {
	const redirect_uri = makeRedirectUri(
		plugin.settings.redirect_host,
		plugin.settings.redirect_port,
	);

	const oAuth2Client = new OAuth2Client({
		clientId: plugin.settings.client_id,
		clientSecret: plugin.settings.client_secret,
		redirectUri: redirect_uri,
	});

	const authorizeUrl = oAuth2Client.generateAuthUrl({
		access_type: "offline",
		scope: plugin.settings.scope,
	});

	const auth_code = await getOAuthCode(
		authorizeUrl,
		plugin.settings.redirect_host,
		plugin.settings.redirect_port,
	);

	const { tokens } = await oAuth2Client.getToken(auth_code);
	oAuth2Client.setCredentials(tokens);

	plugin.settings.refresh_token = tokens.refresh_token;
	plugin.settings.access_token = tokens.access_token;
	plugin.settings.expiry_date = tokens.expiry_date;
	await plugin.saveSettings();

	return oAuth2Client;
}

async function refreshAuthClient(plugin: EmailWranglerPlugin): Promise<OAuth2Client> {
	const redirect_uri = makeRedirectUri(
		plugin.settings.redirect_host,
		plugin.settings.redirect_port,
	);

	const oAuth2Client = new OAuth2Client({
		clientId: plugin.settings.client_id,
		clientSecret: plugin.settings.client_secret,
		redirectUri: redirect_uri,
	});

	const credentials: Credentials = {
		refresh_token: plugin.settings.refresh_token,
		scope: plugin.settings.scope?.join(" "),
		token_type: "Bearer",
	};

	if (plugin.settings.access_token && plugin.settings.expiry_date) {
		credentials.access_token = plugin.settings.access_token;
		credentials.expiry_date = plugin.settings.expiry_date;
	}

	oAuth2Client.setCredentials(credentials);

	const { token, res } = await oAuth2Client.getAccessToken();
	if (res) {
		const expiry_date: number | undefined = res.data?.expiry_date;

		credentials.access_token = token;
		credentials.expiry_date = expiry_date;

		oAuth2Client.setCredentials(credentials);

		plugin.settings.access_token = token;
		plugin.settings.expiry_date = expiry_date;
		await plugin.saveSettings();
	}

	return oAuth2Client;
}

export async function getAuthenticationClient(
	plugin: EmailWranglerPlugin,
): Promise<OAuth2Client> {
	if(!plugin.settings.refresh_token){
		return getNewAuthClient(plugin);
	} else {
		return refreshAuthClient(plugin);
	}
}
