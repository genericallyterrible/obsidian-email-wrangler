import { gmail_v1 } from "googleapis";
import { MethodOptions } from "googleapis-common";
import { FullMailThread, SlimMailThread } from "./thread";

export type ListThreadsParams = gmail_v1.Params$Resource$Users$Threads$List;
export type GetThreadParams = gmail_v1.Params$Resource$Users$Threads$Get;

export interface FetchResponse<Params> {
	/**
	 * HTTP status code of the response.
	 */
	status?: number | null;
	/**
	 * Textual description of the response status.
	 */
	status_text?: string | null;
	/**
	 * Estimated total number of results.
	 */
	result_size_estimate?: number | null;
	/**
	 * Parameters used in the fetch request that generated this response.
	 */
	params?: Params;
	/**
	 * Method options used in the fetch request that generated this response.
	 */
	options?: MethodOptions;
}

export interface ListThreadsResponse extends FetchResponse<ListThreadsParams> {
	/**
	 * Array of threads.
	 */
	threads?: SlimMailThread[];
	/**
	 * Page token to retrieve the next page of results in the list.
	 */
	next_page_token?: string | null;
}

export interface ListFullThreadsResponse extends FetchResponse<ListThreadsParams> {
	/**
	 * Array of threads.
	 */
	threads?: FullMailThread[];
	/**
	 * Page token to retrieve the next page of results in the list.
	 */
	next_page_token?: string | null;
}

export interface GetThreadResponse extends FetchResponse<GetThreadParams> {
	/**
	 * Array of threads.
	 */
	thread: FullMailThread;
}
