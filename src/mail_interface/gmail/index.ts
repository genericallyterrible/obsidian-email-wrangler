import { GmailApi } from "./api";
import { MailThread } from "./thread/thread";

export { GmailApi } from "./api";
export { MailThread } from "./thread/thread";
export { Mailbox } from "./_mailbox";

export async function test_function(
	gmail: GmailApi,
	page_token?: string,
	t_start?: number,
	batch?: number,
	max_results?: number,
) {
	const _t_start = t_start ?? Date.now();
	const _batch = batch ?? 0;
	const _max_results = max_results;

	const response = await MailThread.list_threads(gmail, {
		maxResults: _max_results,
		pageToken: page_token,
	});

	const _t_elapsed = Date.now() - _t_start;
	console.log(
		`${_t_elapsed}ms -> Fetched batch ${_batch}: ${
			response.threads?.length ?? 0
		} threads out of ~${response.result_size_estimate} remaining threads.`,
	);

	if (!response.threads) {
		console.log("No threads");
	}

	if (response.next_page_token) {
		test_function(gmail, response.next_page_token, _t_start, _batch + 1);
	}

	// _t_elapsed = Date.now() - _t_start;
	// console.log(`${_t_elapsed}ms -> Completed batch ${_batch}.`);
}
