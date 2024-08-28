import { gmail_v1, google } from "googleapis";
import EmailWranglerPlugin from "main";
import { time_units } from "utils/units";
import { getAuthenticationClient } from "./oauth";

export const ttl = 5 * time_units.minute;

export class GmailApi {
	private _gmail: gmail_v1.Gmail;

	private constructor(gmail: gmail_v1.Gmail) {
		this._gmail = gmail;
	}

	public static async createInstance(plugin: EmailWranglerPlugin): Promise<GmailApi> {
		const client = await getAuthenticationClient(plugin);
		const gmail = google.gmail({
			version: "v1",
			auth: client,
			// headers: {
			// 	"Cache-Control": "private, max-age=3600, must-revalidate, immutable",
			// }
		});
		return new GmailApi(gmail);
	}

	public get api(): gmail_v1.Gmail {
		return this._gmail;
	}

	public get threads(): gmail_v1.Resource$Users$Threads {
		return this._gmail.users.threads;
	}

	public get messages(): gmail_v1.Resource$Users$Messages {
		return this._gmail.users.messages;
	}

	public get drafts(): gmail_v1.Resource$Users$Drafts {
		return this._gmail.users.drafts;
	}
}
