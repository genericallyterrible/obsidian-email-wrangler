import { gmail_v1 } from "googleapis";
import he from "he";
import { Attachment } from "./attachment";
import { MessageBody } from "./body";
import { MessageHeaders } from "./headers";

/**
 * An email message retrieved from the Gmail API.
 */
export class MailMessage {
	/**
	 * The immutable ID of the message.
	 */
	id: string;
	/**
	 * The ID of the thread the message belongs to. To add a message or draft to a thread, the following criteria must be met: 1. The requested `threadId` must be specified on the `Message` or `Draft.Message` you supply with your request. 2. The `References` and `In-Reply-To` headers must be set in compliance with the [RFC 2822](https://tools.ietf.org/html/rfc2822) standard. 3. The `Subject` headers must match.
	 */
	thread_id?: string | null;
	/**
	 * A short part of the message text.
	 */
	snippet?: string | null;
	/**
	 * The ID of the last history record that modified this message.
	 */
	history_id?: string | null;
	/**
	 * The internal message creation timestamp (epoch ms), which determines ordering in the inbox. For normal SMTP-received email, this represents the time the message was originally accepted by Google, which is more reliable than the `Date` header. However, for API-migrated mail, it can be configured by client to be based on the `Date` header.
	 */
	internal_date?: string | null;
	/**
	 * List of IDs of labels applied to this message.
	 */
	label_ids?: string[] | null;
	/**
	 * The estimated size of the message in bytes.
	 */
	size_estimate?: number | null;
	/**
	 * All headers of the top-level message part representing the entire message payload. It will contain the standard RFC 2822 email headers such as `To`, `From`, and `Subject`.
	 */
	headers: MessageHeaders;
	/**
	 * The body of the email message, containing optional text and HTML parts.
	 */
	body: MessageBody;
	/**
	 * List of attachments in the email message.
	 */
	attachments: Attachment[];

	unread?: boolean;

	/**
	 * Creates a new instance of the MailMessage class.
	 * @param {GmailApi} [gmail] The Gmail API instance.
	 * @param {gmail_v1.Schema$Message} [message] The Gmail message data.
	 * @throws {TypeError} Thrown if the message ID is missing.
	 */
	constructor(message: gmail_v1.Schema$Message) {
		if (!message.id) {
			throw new TypeError("Message ID is required.");
		}

		this.id = message.id;
		this.thread_id = message.threadId;
		this.snippet = message.snippet
			? he.decode(message.snippet).trim()
			: message.snippet;
		this.history_id = message.historyId;
		this.internal_date = message.internalDate;
		this.label_ids = message.labelIds;
		this.size_estimate = message.sizeEstimate;

		this.unread = message.labelIds?.includes("UNREAD");

		this.attachments = [];
		this.body = new MessageBody();
		this.headers = new MessageHeaders(message.payload?.headers);
		this.parse_part(message.payload);
	}

	/**
	 * Maps a list of Gmail API messages to a list of MailMessage instances.
	 * @param {GmailApi} [gmail] The Gmail API instance.
	 * @param {gmail_v1.Schema$Message[]} [messages] The array of Gmail messages.
	 * @returns {MailMessage[] | undefined} The array of mapped MailMessage instances, or undefined if no messages are provided.
	 * @static
	 */
	public static map_messages(
		messages?: gmail_v1.Schema$Message[],
	): MailMessage[] | undefined {
		if (messages == undefined) {
			return undefined;
		}
		return messages.map((msg: gmail_v1.Schema$Message) => {
			return new MailMessage(msg);
		});
	}

	/**
	 * Maps a list of Gmail API messages to a list of MailMessage instances.
	 * @param {GmailApi} [gmail] The Gmail API instance.
	 * @param {gmail_v1.Schema$Message[]} [messages] The array of Gmail messages.
	 * @returns {MailMessage[]} The array of mapped MailMessage instances.
	 * @static
	 */
	public static strict_map_messages(
		messages: gmail_v1.Schema$Message[],
	): MailMessage[] {
		return messages.map((msg: gmail_v1.Schema$Message) => {
			return new MailMessage(msg);
		});
	}

	/**
	 * Recursively parse a message part and its subparts, extracting attachments and the first eligable body html/text.
	 * @param {gmail_v1.Schema$MessagePart} [part] - The message part to parse.
	 * @private
	 */
	private parse_part(part?: gmail_v1.Schema$MessagePart) {
		if (!part) {
			return;
		}

		const { mimeType, parts, body, filename } = part;

		if (!mimeType) {
			throw new TypeError("Could not read mime type");
		}

		if (mimeType.startsWith("multipart")) {
			for (const part of parts ?? []) {
				this.parse_part(part);
			}
			// Multipart blocks are not useful on their own
			return;
		}

		if (body?.attachmentId) {
			this.attachments.push({
				id: body.attachmentId,
				mime_type: mimeType,
				filename: filename,
				size: body.size,
			});
			return;
		}

		if (body?.data != undefined) {
			this.parse_part_body(body.data, mimeType);
			return;
		}

		console.warn(`Unparsed part`, part);
	}

	private parse_part_body(data: string, mimeType: string) {
		if (!["text/plain", "text/html"].includes(mimeType)) {
			return;
		}

		if (mimeType === "text/plain" && !this.body.has_text) {
			this.body.text = data;
			return;
		}

		if (mimeType === "text/html" && !this.body.has_html) {
			this.body.html = data;
			return;
		}
	}

	/**
	 * Get the "From" header value(s).
	 * @returns {string | string[] | undefined} The "From" header value(s), or undefined if not found.
	 */
	public get from_all(): string | string[] | undefined {
		return this.headers.get("From");
	}

	/**
	 * Get the "From" header value.
	 * @returns {string | undefined} The "From" header value, or undefined if not found.
	 */
	public get from(): string | undefined {
		return this.headers.get_first("From");
	}

	/**
	 * Get the "To" header value(s).
	 * @returns {string | string[] | undefined} The "To" header value(s), or undefined if not found.
	 */
	public get to_all(): string | string[] | undefined {
		return this.headers.get("To");
	}

	/**
	 * Get the "To" header value.
	 * @returns {string | undefined} The "To" header value(s), or undefined if not found.
	 */
	public get to(): string | undefined {
		return this.headers.get_first("To");
	}

	/**
	 * Get the "Cc" header value(s).
	 * @returns {string | string[] | undefined} The "Cc" header value(s), or undefined if not found.
	 */
	public get cc_all(): string | string[] | undefined {
		return this.headers.get("Cc");
	}

	/**
	 * Get the "Cc" header value.
	 * @returns {string | undefined} The "Cc" header value, or undefined if not found.
	 */
	public get cc(): string | undefined {
		return this.headers.get_first("Cc");
	}

	/**
	 * Get the "Subject" header value(s).
	 * @returns {string | string[] | undefined} The "Subject" header value(s), or undefined if not found.
	 */
	public get subject_all(): string | string[] | undefined {
		return this.headers.get("Subject");
	}

	/**
	 * Get the "Subject" header value.
	 * @returns {string | undefined} The "Subject" header value, or undefined if not found.
	 */
	public get subject(): string | undefined {
		return this.headers.get_first("Subject");
	}

	/**
	 * Get the "Date" header value(s).
	 * @returns {string | string[] | undefined} The "Date" header value(s), or undefined if not found.
	 */
	public get date_all(): string | string[] | undefined {
		return this.headers.get("Date");
	}

	/**
	 * Get the "Date" header value.
	 * @returns {string | undefined} The "Date" header value, or undefined if not found.
	 */
	public get date(): string | undefined {
		return this.headers.get_first("Date");
	}

	/**
	 * Get the "In-Reply-To" header value(s).
	 * @returns {string | string[] | undefined} The "In-Reply-To" header value(s), or undefined if not found.
	 */
	public get in_reply_to_all(): string | string[] | undefined {
		return this.headers.get("In-Reply-To");
	}

	/**
	 * Get the "In-Reply-To" header value.
	 * @returns {string | undefined} The "In-Reply-To" header value, or undefined if not found.
	 */
	public get in_reply_to(): string | undefined {
		return this.headers.get_first("In-Reply-To");
	}

	/**
	 * Get the "References" header value(s).
	 * @returns {string | string[] | undefined} The "References" header value(s), or undefined if not found.
	 */
	public get references_all(): string | string[] | undefined {
		return this.headers.get("References");
	}

	/**
	 * Get the "References" header value.
	 * @returns {string | undefined} The "References" header value, or undefined if not found.
	 */
	public get references(): string | undefined {
		return this.headers.get_first("References");
	}
}
