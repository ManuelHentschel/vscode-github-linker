
import * as vscode from 'vscode';

import { copyGithubUrlFromSelection, openGithubUrlFromSelection } from './githubUrl';

import { openFileFromClipboardUrl } from './openFile';

export async function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('githubLinker.copyUrl', () => {
		copyGithubUrlFromSelection();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('githubLinker.openUrlInBrowser', () => {
		openGithubUrlFromSelection();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('githubLinker.openFileFromUrl', () => {
		openFileFromClipboardUrl();
	}));
}


// this method is called when the extension is deactivated
export function deactivate() {
	// dummy
}
