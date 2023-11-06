import { App, Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";

import { EmailWranglerSettingTab } from "SettingTab";
import { EmailWranglerSettings, DEFAULT_SETTINGS } from "Settings";
import { getAuthenticationClient } from "mail_interface/gmail/oauth";

import { google } from "googleapis";

export default class EmailWranglerPlugin extends Plugin {
	/**
	 * @public
	 */
	settings: EmailWranglerSettings;

	async onload() {
		await this.loadSettings();
		const oAuth2Client = await getAuthenticationClient(this);
		const gmail = google.gmail({
			version: "v1",
			auth: oAuth2Client,
		});
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"My hover text",
			(_evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("EMail Time!");

				gmail.users.threads
					.list({
						userId: "me",
						maxResults: 1,
					})
					.then((res) => {
						const threads = res.data.threads;
						if (!threads || threads.length === 0) {
							console.log("No threads found.");
						} else {
							gmail.users.threads
								.get({
									userId: "me",
									id: threads[0].id!,
								})
								.then((tr) => {
									console.log(tr);
									const snippet = tr.data.snippet;
									const headers =
										tr.data.messages?.at(0)?.payload?.headers;
									if (headers) {
										const sender = headers.find(
											(item) => item?.name === "From",
										)?.value;
										const recipient = headers.find(
											(item) => item?.name === "To",
										)?.value;
										const subject = headers.find(
											(item) => item?.name === "Subject",
										)?.value;
										const date = headers.find(
											(item) => item?.name === "Date",
										)?.value;
										if (subject) new Notice(subject);
									}
								});
						}
					});
			},
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EmailWranglerSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, "click", (evt: MouseEvent) => {
		// 	console.log("click", evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(
		// 	window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
		// );
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
