// Remember to rename these classes and interfaces!
export interface EmailWranglerSettings {
	client_id: string;
	client_secret: string;
	redirect_host: string;
	redirect_port: number;
	refresh_token?: string | null;
	access_token?: string | null;
	expiry_date?: number | null;
	scope?: [string];
}
export const DEFAULT_SETTINGS: Partial<EmailWranglerSettings> = {
	redirect_host: "http://localhost",
	redirect_port: 3000,
	scope: ["https://mail.google.com/"],
};
