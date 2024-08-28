import he from "he";
import { DefferedParse } from "utils/deffered_parse";

const dom_parser = new DOMParser();

/**
 * The body of a MailMessage, containing optional text and HTML parts.
 */
export class MessageBody {
	private _text: DefferedParse<string, string>;
	private _html: DefferedParse<string, Document>;
	/**
	 * The plain text part of the message body.
	 */
	// @ts-expect-error: TS2380
	get text(): string | undefined {
		return this._text.value;
	}
	/**
	 * Set the plain text part of the message body.
	 * @param {string} [raw_text] The raw text to be parsed and set.
	 */
	set text(raw_text: string) {
		this._text.value = raw_text;
	}
	/**
	 * Check if the message body has plain text.
	 */
	public get has_text() {
		return this._text.has_value;
	}
	/**
	 * The HTML part of the message body.
	 */
	// @ts-expect-error: TS2380
	get html(): Document | undefined {
		return this._html.value;
	}
	/**
	 * Set the HTML part of the message body.
	 * @param {string} [raw_html] The raw HTML to be parsed and set.
	 */
	set html(raw_html: string) {
		this._html.value = raw_html;
	}
	/**
	 * Check if the message body has HTML.
	 */
	public get has_html() {
		return this._html.has_value;
	}
	/**
	 * Create a new MessageBody instance.
	 * @param {string} [raw_text] The raw text for the plain text part.
	 * @param {string} [raw_html] The raw HTML for the HTML part.
	 */
	constructor(raw_text?: string, raw_html?: string) {
		this._text = new DefferedParse<string, string>(
			(raw) => he.decode(Buffer.from(raw ?? "", "base64").toString("utf-8")),
			raw_text,
		);
		this._html = new DefferedParse<string, Document>(
			(raw) =>
				dom_parser.parseFromString(
					Buffer.from(raw ?? "", "base64").toString("utf-8"),
					"text/html",
				),
			raw_html,
		);
	}
}
