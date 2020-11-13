
import * as vscode from 'vscode';

import { copyGithubUrlFromSelection, openGithubUrlFromSelection } from './githubUrl';

import { openFileFromClipboardUrl } from './openFile';

import { config } from './utils';



export async function activate(context: vscode.ExtensionContext) {

	console.log('[github-linker-2]: activating...');

	context.subscriptions.push(vscode.commands.registerCommand('githubLinker.copyUrl', () => {
		copyGithubUrlFromSelection();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('githubLinker.openUrlInBrowser', () => {
		openGithubUrlFromSelection();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('githubLinker.openFileFromUrl', () => {
		openFileFromClipboardUrl();
	}));

	const showInContextMenu = config().get<boolean>('showInContextMenu', true);
	vscode.commands.executeCommand('setContext', 'githubLinker.showInContextMenu', showInContextMenu);

	console.log('[github-linker-2]: done.');
}


// this method is called when the extension is deactivated
export function deactivate() {
	// dummy
}
