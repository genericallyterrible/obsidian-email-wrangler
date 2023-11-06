// Remember to rename these classes and interfaces!
export interface EmailWranglerSettings {
	client_id: string;
	client_secret: string;
	associated_email?: string;
	scope?: string[];
	refresh_token?: string | null;
	access_token?: string | null;
	expiry_date?: number | null;
}
export const DEFAULT_SETTINGS: Partial<EmailWranglerSettings> = {
	scope: ["https://mail.google.com/"],
};
