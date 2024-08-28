/**
 * Parameters for construting an AsyncTtl instance.
 * @template T - The type of data to be stored.
 */
export interface AsyncTtlParams<T> {
	/**
	 * Time-to-live duration in milliseconds.
	 */
	max_age: number;
	/**
	 * Time before expiry to pre-emptively re-fetch the data in milliseconds.
	 */
	early_refresh?: number;
	/**
	 * Async function that fetches the data. Should return a Promise of type T or undefined.
	 */
	fetch: () => Promise<T>;
	/**
	 * Optional validator function to check if the fetched data is valid.
	 */
	validator?: (data: T) => boolean;
	/**
	 * Pre-loaded data to initialize the AsyncTtl instance.
	 */
	pre_load?: T;
}

/**
 * Represents the status of an AsyncTtl instance, indicating whether the stored data is stale or expiring.
 */
interface TtlStatus {
	/**
	 * True if the data is fresh, false otherwise.
	 * Data may be considered fresh, even if expired if `_stale_while_revalidate` is set.
	 */
	fresh: boolean;
	/**
	 * True if new data is should be fetched, false otherwise.
	 */
	fetch: boolean;
}

/**
 * A simple async Time-to-Live (TTL) manager for a single piece of data.
 * After expiration, lazily refreshes its contents next time `data` is requested.
 * @template T - The type of data to be stored.
 * @see {@link AsyncTtlParams} for the parameters required to instantiate an AsyncTtl instance.
 */
export class AsyncTtl<T> {
	/**
	 * Time-to-Live duration in milliseconds.
	 * @private
	 */
	private _max_age: number;
	/**
	 * Time before expiry to pre-emptively re-fetch the data in milliseconds.
	 * @private
	 */
	private _early_refresh?: number;

	private _stale_while_revalidate?: number;
	/**
	 * Stored data, may be undefined if not loaded.
	 * @private
	 */
	private _data: T;
	/**
	 * Expiration timestamp for the current data.
	 * @private
	 */
	private _expiry?: number;
	/**
	 * Async function responsible for fetching new data.
	 * @private
	 */
	private _fetch: () => Promise<T>;
	/**
	 * Promise for the current fetch operation, used to avoid concurrent fetches.
	 * @private
	 */
	private _fetching?: Promise<T>;
	/**
	 * Function to validate if the data is valid.
	 * @private
	 */
	private _data_valid: (data: T) => boolean = Boolean;

	constructor({
		max_age,
		early_refresh,
		fetch,
		validator,
		pre_load,
	}: AsyncTtlParams<T>) {
		this._max_age = max_age;
		this._early_refresh = early_refresh;
		this._fetch = fetch;

		if (validator) {
			this._data_valid = validator;
		}
		if (pre_load == undefined || !this.update(pre_load)) {
			this._do_fetch();
		}
	}

	/**
	 * Returns the current status of the {@link AsyncTtl} instance, indicating whether the stored data is stale or expiring.

	 * @returns {TtlStatus} An object containing information about the status of the data.
	 * - If the data is stale: `{ stale: true, expiring: true }`
	 * - If the data is not stale and expiring soon: `{ stale: false, expiring: true }`
	 * - If the data is not stale and not expiring soon: `{ stale: false, expiring: false }`
	 * 	@private
	 */
	private get _status(): TtlStatus {
		if (this._expiry == undefined || !this._data_valid(this._data)) {
			return { fresh: false, fetch: true };
		}

		const now = Date.now();
		if (this._stale_while_revalidate) {
			const stale_while = this._expiry + this._stale_while_revalidate;
			// Too stale to use
			if (stale_while < now) {
				return { fresh: false, fetch: true };
			}
			// Stale, but we're allowed to use it while we fetch new data
			if (this._expiry < now && now <= stale_while) {
				return { fresh: true, fetch: true };
			}
		}

		if (this._early_refresh) {
			// Fresh, but we're going to initiate a background fetch
			if (this._early_refresh <= now && now <= this._expiry) {
				return { fresh: true, fetch: true };
			}
		}

		const fresh = now <= this._expiry;
		return {
			fresh: fresh,
			fetch: !fresh,
		};
	}

	/**
	 * Fetches new data using the provided fetch function and updates the instance, resolving to the new state of `this._data`.
	 * If a fetch operation is already in progress, reuses the existing promise to avoid concurrent fetches.
	 * @returns {Promise<T>} A Promise containing the current data or undefined if still not available after a fetch.
	 * @private
	 */
	private _do_fetch(): Promise<T> {
		if (this._fetching === undefined) {
			this._fetching = this._fetch()
				.then((result) => {
					if (!this.update(result)) {
						console.warn("Failed to update data in fetch.");
					}
					return this._data;
				})
				.finally(() => {
					this._fetching = undefined;
				});
		} else {
			console.debug("Re-using promise");
		}
		// Return the current or newly initiated fetch promise
		return this._fetching;
	}

	public get loaded(): boolean {
		return this._expiry !== undefined;
	}

	/**
	 * Asynchronously retrieves the current data, fetching new data as necessary. Only calls `fetch_callback` if new data is fetched.
	 * @param {(value: T) => void} [fetch_callback] Callback function to be called if new data is fetched.
	 *  @returns A Promise containing the current data.
	 */
	public get_data(fetch_callback?: (value: T) => void): Promise<T> {
		return new Promise((resolve, reject) => {
			try {
				const { fresh, fetch } = this._status;
				if (fetch) {
					const promise = this._do_fetch();
					promise.then(fetch_callback);
					if (!fresh) {
						resolve(promise);
						return;
					}
				}
				resolve(this._data);
				return;
			} catch (e) {
				reject(e);
				return;
			}
		});
	}

	/**
	 * Asynchronously retrieves the current data, fetching new data as necessary.
	 *  @returns A Promise containing the current data.
	 */
	public get data(): Promise<T> {
		return this.get_data();
	}

	/**
	 * If the provided data is valid, updates the stored data and refreshes the expiration time.
	 * @param {T} [data] The new data to be set.
	 * @returns {Mboolean} Flag indicating if `data` was valid and actual caused an update.
	 */
	public update(data: T): boolean {
		if (this._data_valid(data)) {
			this._data = data;
			this.refresh_expiry();
			return true;
		}
		return false;
	}

	/**
	 * Manually refreshes the expiration time.
	 */
	public refresh_expiry(): void {
		this._expiry = Date.now() + this._max_age;
	}

	/**
	 * Marks the current data as stale, forcing a fetch the next time `AsyncTtl.data` is retrieved. Does **not** delete the data.
	 */
	public invalidate(): void {
		this._expiry = 0;
	}
}
