/**
 * A class representing deferred parsing of a value.
 * @template StoredAs The type of the raw data to be parsed.
 * @template ParsedTo The type of the parsed result.
 */
export class DefferedParse<StoredAs, ParsedTo> {
	/** The raw data to be parsed. */
	_raw?: StoredAs;
	/** The parsed result. */
	_value?: ParsedTo;
	/** Flag indicating whether the data has been parsed. */
	_parsed?: boolean;
	/** The parser function used to parse the raw data. */
	parser: (raw?: StoredAs) => ParsedTo | undefined;

	/**
	 * Creates a new instance of the DeferredParse class.
	 * @param {function} [parser] The parser function to be used.
	 * @param {StoredAs} [raw] The initial raw data to be parsed.
	 */
	constructor(parser: (raw?: StoredAs) => ParsedTo | undefined, raw?: StoredAs) {
		this.parser = parser;
		if (raw != undefined) {
			this.value = raw;
		}
	}

	/**
	 * Sets the raw data to be parsed.
	 * @param {StoredAs} [raw] The raw data to be parsed.
	 */
	public set value(raw: StoredAs) {
		this._parsed = false;
		this._raw = raw;
	}

	/**
	 * Gets the parsed result, parsing the raw data if necessary.
	 * @returns {ParsedTo | undefined} The parsed result.
	 */
	// @ts-expect-error: TS2380
	public get value(): ParsedTo | undefined {
		if (!this._parsed) {
			this._parsed = true;
			this._value = this.parser(this._raw);
			this._raw = undefined;
		}
		return this._value;
	}

	/**
	 * Checks if the instance has a value (parsed or raw).
	 * @returns {boolean} True if the instance has a value, false otherwise.
	 */
	public get has_value(): boolean {
		return this._parsed != undefined;
	}
}
