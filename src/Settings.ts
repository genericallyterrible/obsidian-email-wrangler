export interface EmailWranglerSettings {
	client_id: string;
	client_secret: string;
	associated_email?: string;
	scope?: string[];
	refresh_token?: string | null;
}
export const DEFAULT_SETTINGS: Partial<EmailWranglerSettings> = {
	scope: ["https://mail.google.com/"],
};
