import { gmail_v1 } from "googleapis";
import { MethodOptions } from "googleapis-common";
import { GmailApi } from "../api";
import { MailMessage } from "../message/message";
import {
	GetThreadParams,
	GetThreadResponse,
	ListFullThreadsResponse,
	ListThreadsParams,
	ListThreadsResponse,
} from "./interfaces";

type ThreadType = "Slim" | "Full";

export class MailThread {
	public isSlim(): this is SlimMailThread {
		return this.thread_type === "Slim";
	}

	public isFull(): this is FullMailThread {
		return this.thread_type === "Full";
	}

	protected constructor(
		/**
		 * The Gmail API instance used for communication.
		 */
		protected gmail: GmailApi,
		protected thread_type: ThreadType,
		protected _id: string,
		protected _history_id?: string | null,
		protected _snippet?: string | null,
	) {}

	public get id(): string {
		return this._id;
	}

	public get history_id(): string | null | undefined {
		return this._history_id;
	}

	public get snippet(): string | null | undefined {
		return this._snippet;
	}

	private static map_slim_threads(
		gmail: GmailApi,
		threads?: gmail_v1.Schema$Thread[],
	): SlimMailThread[] | undefined {
		if (!threads) {
			return undefined;
		}
		return threads.map(
			(thread: gmail_v1.Schema$Thread) => new SlimMailThread(gmail, thread),
		);
	}

	public static async list_threads(
		gmail: GmailApi,
		params: ListThreadsParams,
		options?: MethodOptions,
	): Promise<ListThreadsResponse> {
		params.userId = params.userId ?? "me";
		const response = await gmail.threads.list(params, options);

		// console.log(response);
		// TODO: Handle response status?
		return {
			status: response.status,
			status_text: response.statusText,
			threads: MailThread.map_slim_threads(gmail, response.data.threads),
			next_page_token: response.data.nextPageToken,
			result_size_estimate: response.data.resultSizeEstimate,
			params: params,
			options: options,
		};
	}

	public static async list_full_threads(
		gmail: GmailApi,
		params: ListThreadsParams,
		options?: MethodOptions,
	): Promise<ListFullThreadsResponse> {
		params.userId = params.userId ?? "me";
		const response = await gmail.threads.list(params, options);

		const slims = MailThread.map_slim_threads(gmail, response.data.threads);
		const fulls = slims
			? await Promise.all(slims.map(async (slim) => slim.get_full(options)))
			: undefined;

		// console.log(response);
		// TODO: Handle response status?
		return {
			status: response.status,
			status_text: response.statusText,
			threads: fulls,
			next_page_token: response.data.nextPageToken,
			result_size_estimate: response.data.resultSizeEstimate,
			params: params,
			options: options,
		};
	}

	public static async get_thread(
		gmail: GmailApi,
		params: GetThreadParams,
		options?: MethodOptions,
	): Promise<GetThreadResponse> {
		params.userId = params.userId ?? "me";
		const response = await gmail.threads.get(params, options);

		// console.log(response);
		// TODO: Handle response status?
		return {
			status: response.status,
			status_text: response.statusText,
			thread: new FullMailThread(gmail, response.data),
			params: params,
			options: options,
		};
	}
}

export class SlimMailThread extends MailThread {
	constructor(gmail: GmailApi, { historyId, id, snippet }: gmail_v1.Schema$Thread) {
		if (!id) {
			throw new TypeError("Id is required");
		}
		super(gmail, "Slim", id, historyId, snippet);
	}

	public async get_full(options?: MethodOptions): Promise<FullMailThread> {
		return (await MailThread.get_thread(this.gmail, { id: this._id }, options))
			.thread;
	}
}

export class FullMailThread extends MailThread {
	/**
	 * The list of messages in the thread.
	 */
	messages: MailMessage[];
	unread?: boolean | null;
	subject?: string | null;

	constructor(
		gmail: GmailApi,
		{ historyId, id, snippet, messages }: gmail_v1.Schema$Thread,
	) {
		if (!id) {
			throw new TypeError("Id is required");
		}
		if (!messages || messages.length == 0) {
			throw new TypeError(
				"FullMailThread requires all messages, did you mean to use 'SlimMailThread'?",
			);
		}
		super(gmail, "Full", id, historyId, snippet);
		this.messages = MailMessage.strict_map_messages(messages);

		// All messages in a thread have the same subject
		this.subject = this.messages[0].subject;

		// All messages read?
		const last_msg = this.messages[messages.length - 1];
		if (last_msg.unread === false) {
			this._snippet = last_msg.snippet ?? undefined;
			this.unread = false;
			return;
		}

		// Find first unread
		for (const message of this.messages) {
			if (message.unread === true) {
				this._snippet = message.snippet ?? undefined;
				this.unread = true;
				return;
			}
		}

		this._snippet = this.messages[0].snippet;
	}
}
