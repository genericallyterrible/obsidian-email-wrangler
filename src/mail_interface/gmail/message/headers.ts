import { gmail_v1 } from "googleapis";

/**
 * The headers of a message.
 */
export class MessageHeaders {
	/**
	 * Internal storage for message headers.
	 * @private
	 */
	private _headers: Map<string, string | string[]>;
	/**
	 * The total number of stored values in the headers.
	 * @private
	 */
	private _stored_vals: number;
	/**
	 * Creates an instance of MessagePartHeaders.
	 * @param {gmail_v1.Schema$MessagePartHeader[] | undefined} [headers] An array of message part headers to initialize the instance.
	 */
	constructor(headers?: gmail_v1.Schema$MessagePartHeader[]) {
		this._headers = new Map<string, string | string[]>();
		this._stored_vals = 0;

		for (const header of headers ?? []) {
			this.push(header);
		}
	}
	/**
	 * Adds a message part header to the collection.
	 * @param {gmail_v1.Schema$MessagePartHeader} [header] The message part header to add.
	 * @private
	 */
	private push(header: gmail_v1.Schema$MessagePartHeader) {
		const { name, value } = header;
		if (!name || !value) {
			return;
		}

		const val = this._headers.get(name);
		if (val === undefined) {
			this._headers.set(name, value);
		} else if (typeof val === "string") {
			this._headers.set(name, [val, value]);
		} else {
			val.push(value);
		}
		this._stored_vals += 1;
	}
	/**
	 * Get the value(s) of a header by name.
	 * @param {string} [name] The name of the header.
	 * @returns {string | string[] | undefined} The value(s) of the header, or undefined if not found.
	 */
	public get(name: string): string | string[] | undefined {
		return this._headers.get(name);
	}
	/**
	 * Get the first value of a header by name.
	 * @param {string} [name] The name of the header.
	 * @returns {string | string[] | undefined} The first value of the header, or undefined if not found.
	 */
	public get_first(name: string): string | undefined {
		const val = this._headers.get(name);
		if (val === undefined) {
			return undefined;
		}
		if (typeof val === "string") {
			return val;
		}
		return val[0];
	}
}
