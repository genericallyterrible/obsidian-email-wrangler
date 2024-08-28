import { MethodOptions } from "googleapis-common";
import { LRUCache } from "lru-cache";
import { AsyncTtl } from "utils/ttl";
import { time_units } from "utils/units";
import { GmailApi } from "./api";
import { ListThreadsParams } from "./thread/interfaces";
import { FullMailThread, MailThread } from "./thread/thread";

type TtlThread = AsyncTtl<MailThread>;
const thread_ttl = 15 * time_units.minute;

export class Mailbox {
	threads: LRUCache<string, TtlThread>;

	constructor(protected gmail: GmailApi) {
		this.gmail = gmail;
		this.threads = new LRUCache<string, TtlThread>({
			max: 100,
		});
	}

	public async list_threads(params: ListThreadsParams, options?: MethodOptions) {
		params.userId = params.userId ?? "me";
		const response = await MailThread.list_threads(this.gmail, params, options);

		for (const thread of response.threads ?? []) {
			console.log(thread);
		}
	}

	private new_full_ttl(id: string) {
		const _ttl = new AsyncTtl<FullMailThread>({
			max_age: thread_ttl,
			fetch: () =>
				MailThread.get_thread(this.gmail, { id: id }).then(
					(response) => response.thread,
				),
		});
		return _ttl;
	}

	public async get_thread(id: string): Promise<MailThread> {
		const thread = this.threads.get(id);

		if (thread != undefined) {
			return thread.data;
		}

		const _ttl = this.new_full_ttl(id);
		this.threads.set(id, _ttl);
		return _ttl.data;
	}

	private async get_full(id: string): Promise<FullMailThread> {
		const cached = this.threads.get(id);
		if (cached != undefined) {
			const thread = await cached.data;
			if (thread.isFull()) {
				return thread;
			}
		}

		const new_ttl = this.new_full_ttl(id);
		this.threads.set(id, cached);
		return new_ttl.data;
	}
}
