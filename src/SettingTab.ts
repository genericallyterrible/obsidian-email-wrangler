import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import EmailWranglerPlugin from "main";
import { getNewAuthClient } from "oauth/oauth";

export class EmailWranglerSettingTab extends PluginSettingTab {
	plugin: EmailWranglerPlugin;

	constructor(app: App, plugin: EmailWranglerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Client ID")
			.setDesc("Client ID desc")
			.addText((text) =>
				text
					.setPlaceholder("Enter your CLIENT_ID")
					.setValue(this.plugin.settings.client_id)
					.onChange(async (value) => {
						this.plugin.settings.client_id = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Client Secret")
			.setDesc("Client Secret desc")
			.addText((text) =>
				text
					.setPlaceholder("Enter your CLIENT_SECRET")
					.setValue(this.plugin.settings.client_secret)
					.onChange(async (value) => {
						this.plugin.settings.client_secret = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Refresh Token")
			.setDesc("Refresh Token desc")
			.addExtraButton((button) => {
				button
					.setIcon("lucide-rotate-ccw")
					.setTooltip("Regenerate")
					.onClick(() => {
						new Notice("OAuth Time!");
						getNewAuthClient(this.plugin).then((oauth) => {
							oauth.getAccessToken().then((response) => {
								console.log(response);
							});
						});
					});
			})
			.addText((text) => {
				text.setValue(
					this.plugin.settings.refresh_token ?? "Unset",
				).setDisabled(true);
			});
	}
}
