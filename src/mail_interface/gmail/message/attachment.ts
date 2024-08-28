/**
 * An attachment in a MailMessage.
 */
export interface Attachment {
	/**
	 * The unique ID of the attachment.
	 */
	id: string;
	/**
	 * The MIME type of the attachment.
	 */
	mime_type: string;
	/**
	 * The filename of the attachment.
	 */
	filename?: string | null;
	/**
	 * The estimated size of the attachment in bytes.
	 */
	size?: number | null;
}
