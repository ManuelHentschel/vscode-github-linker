
import * as vscode from 'vscode';
import * as path from 'path';

// Import the declaration of the git API:
import * as git from './git';
import { fillTemplate, config, SearchReplacePattern } from './utils';
import { S_IFDIR } from 'constants';


//// Helpers:

// used to return the url together with info about the success/failure of finding it:
interface UrlResult {
	url?: string;
	msg?: string;
	errorCode: 0 | 1 | 2;
}

// helper function, used to abort the url-creation if e.g. no repo is found
function assert(condition: any, message: string = 'Assertion failed!') {
	if (!condition) {
		throw new Error(message);
	}
}

//// Main functions:

// copy github url to selection
// also shows a button with the option to open in browser
export async function copyGithubUrlFromSelection(): Promise<boolean> {
	// try to make github url
	const { url, msg, errorCode }: UrlResult = await makeGithubUrlFromSelection();

	// fatal error, show message and abort
	if (errorCode === 2) {
		vscode.window.showErrorMessage(msg);
		return false;
	}

	// write text to clipboard
	vscode.env.clipboard.writeText(url);
	const info = `Copied Github URL to clipboard. `;
	let shouldOpenInBrowser: string = undefined;

	if (errorCode === 1) {
		// produced a warning, but still returned an (invalid?) URL
		shouldOpenInBrowser = await vscode.window.showWarningMessage(`${info}${msg}`, 'Open in browser');
	} else {
		shouldOpenInBrowser = await vscode.window.showInformationMessage(info, 'Open in browser');
	}

	// open in Browser if the user clicks the button
	if (shouldOpenInBrowser) {
		return openInBrowser(url);
	}

	return true;
}

// open github url to selection:
export async function openGithubUrlFromSelection(): Promise<boolean> {
	const { url: url, msg: msg, errorCode: errorCode }: UrlResult = await makeGithubUrlFromSelection();

	if (errorCode === 2) {
		// fatal error: show message and abort
		vscode.window.showErrorMessage(msg);
		return false;
	} else if (errorCode === 1) {
		// warning, try to open (invalid?) url
		vscode.window.showWarningMessage(msg);
	}

	return openInBrowser(url);
}


async function openInBrowser(url: string){
	const uri = vscode.Uri.parse(url);
	const opened = uri.scheme.match(/https?/) && await vscode.env.openExternal(uri);
	if(!opened){
		vscode.window.showErrorMessage(`Failed to open: ${uri.toString()}`);
	}
	return opened;
}

//// Helper functions:

// wrapper function that make the github url for the current selection
async function makeGithubUrlFromSelection(): Promise<UrlResult> {
	try {
		// get active editor (or abort if none active)
		const editor = vscode.window.activeTextEditor;
		assert(editor, 'No active editor found!');

		// get selected range
		const line0 = editor.selection.start.line + 1;
		const line1 = editor.selection.end.line + 1;

		// make and return github url
		const doc = editor.document;
		const ret = await makeGithubUrl(doc, line0, line1);
		return ret;
	} catch (e) {
		const msg = `Could not copy GitHub URL: ${(<Error>e).message}`;
		return {
			url: '',
			msg: msg,
			errorCode: 2,
		};
	}
}


// combines the above functions to make the gtihub url for a specified document and line position
async function makeGithubUrl(doc: vscode.TextDocument, line0: number = 0, line1: number = 0): Promise<UrlResult> {
	// get repo the file is in
	const repo = getRepo(doc.uri);

	// make base url for repo
	const repoUrl = makeRepoBaseUrl(repo);

	// check for changes to the file that might invalidate the remote url
	// is only used to warn the user, but still produces an URL
	const ret = await getRemoteCommit(doc, repo);

	const templateVars: {[key: string]: string|number} = {
		...ret.commitIds,
		repoUrl: repoUrl,
		path0: doc.uri.fsPath,
		line0: line0,
		line1: line1
	};

	// make line specification (e.g. #L1-L3), if lines are supplied
	let lineSpecTemplate: string = '';
	if (line1 && line0 !== line1) {
		// lineSpecTemplate = '#L${line0}:L${line1}';
		lineSpecTemplate = config().get<string>('templates.twoLineNumbers', '#L${line0}:L${line1}');
	} else if (line0) {
		lineSpecTemplate = config().get<string>('templates.oneLineNumber', '#L${line0}');
	}
	templateVars.lineSpec = fillTemplate(lineSpecTemplate, templateVars);

	// combine to url
	const urlTemplateDefault = '${repoUrl}/blob/${remoteHash}/${relativePath}${lineSpec}';
	const urlTemplate = config().get<string>('templates.githubUrl', urlTemplateDefault);
	const url = fillTemplate(urlTemplate, templateVars);

	return {
		url: url,
		msg: ret.msg,
		errorCode: ret.msg ? 1 : 0,
	};
}


// get the repo of the active file form vscode's git extension api
function getRepo(uri: vscode.Uri): git.Repository | null {
	// get git api
	const gitExtension = vscode.extensions.getExtension<git.GitExtension>('vscode.git');
	assert(gitExtension, 'Git extension not installed or not activated yet!');
	const api = gitExtension.exports.getAPI(1);

	// retrieve repo from api
	const repo = api.getRepository(uri);
	assert(repo, 'Not a Git repository!');
	return repo;
}

// read remote url from repo, then apply regexes to convert e.g. ssh-urls to http-urls
function makeRepoBaseUrl(repo: git.Repository): string {
	// read relevant config
	const patterns = config().get<SearchReplacePattern[]>('patterns.githubUrl', []);
	const useFetchUrl = config().get<boolean>('githubUrl.useFetchUrl', true);
	const remoteId = config().get<number>('githubUrl.remoteId', 0);

	// read url from repo
	const nRemotes = repo.state.remotes.length;
	assert(nRemotes, 'The Git repository does not have any remotes!');
	const remote = repo.state.remotes[Math.min(remoteId, nRemotes-1)];
	let url: string = (useFetchUrl ? remote.fetchUrl : remote.pushUrl) || '';

	// apply search replace patterns
	for (const pattern of patterns) {
		const re = new RegExp(pattern.search);
		url = url.replace(re, pattern.replace);
	}

	return url;
}

// get path of the file relative to repo root
function getRelativePath(uri: vscode.Uri, repo: git.Repository) {
	const root = repo.rootUri.fsPath;
	const file = uri.fsPath;
	let relativePath = path.relative(root, file);

	// on windows: convert backslashes
	if (path.sep === '\\') {
		relativePath = relativePath.replace(/\\/g, '/');
	}
	return relativePath;
}


interface CommitIds {
	localBranch: string;
	remoteBranch: string;
	localHash: string;
	remoteHash: string;
	tag: string | '';
	tagOrBranch: string;
	tagOrLocalHash: string;
	tagOrRemoteHash: string;
	remoteName: string;
	relativePath: string;
}

interface RemoteCommit {
	msg: string;
	commitIds: CommitIds;
}



async function getRemoteCommit(doc: vscode.TextDocument, repo: git.Repository): Promise<RemoteCommit>{

	// helper function to check if the document is affected by an array of changes
	function containsUri(changes: git.Change[]): boolean {
		for (const change of changes) {
			if (change.uri.toString() === doc.uri.toString()) {
				return true;
			}
		}
		return false;
	}

	// prepare return values
	const ids: CommitIds = {
		localBranch: '',
		remoteBranch: '',
		localHash: '',
		remoteHash: '',
		tag: '',
		tagOrBranch: '',
		tagOrLocalHash: '',
		tagOrRemoteHash: '',
		remoteName: '',
		relativePath: ''
	};
	let msg = '';

	// warn if the file contains unsaved/uncomitted changes
	ids.relativePath = getRelativePath(doc.uri, repo);
	if(doc.isDirty){
		msg += '\nThe editor contains unsaved changes.';
	}
	const indexVsHead = await repo.diffIndexWithHEAD(ids.relativePath);
	if(indexVsHead || containsUri(repo.state.workingTreeChanges)){
		msg += '\nThe file contains uncomitted changes.';
	}

	const head = repo.state.HEAD;
	const remoteId = config().get<number>('githubUrl.remoteId', 0);
	const nRemotes = repo.state.remotes.length;
	const remote = repo.state.remotes[Math.min(remoteId, nRemotes)];
	const refs = repo.state.refs;
	let headRef: git.Ref;

	if(head){
		headRef = head;
		const upstream = head.upstream;
		if(upstream){
			ids.remoteName = upstream.remote;
			ids.remoteBranch = upstream.name;
			ids.remoteHash = (await repo.getCommit(`${ids.remoteName}/${ids.remoteBranch}`)).hash;

			const upstreamName = `${upstream.remote}/${upstream.name}`;
			const headVsRemote = await repo.diffBetween('HEAD', upstreamName);
			const remoteVsHead = await repo.diffBetween(upstreamName, 'HEAD'); // not sure if both are necessary
			if (containsUri(headVsRemote) || containsUri(remoteVsHead)) {
				msg += '\nThe file is ahead/behind the remote.';
			}
		}
	} else{
		msg += '\nCould not identify a HEAD reference.';
		assert(refs.length, 'No refs found. Make sure to have at least one branch/commit.');
		headRef = refs[0];
	}

	assert(headRef.commit, 'No refs found. Make sure to have at least one branch/commit.');

	ids.localHash = headRef.commit;
	ids.localBranch = headRef.name;

	// fill fallbacks:
	ids.remoteHash = ids.remoteHash || ids.localHash;
	ids.remoteBranch = ids.remoteBranch || ids.localBranch || ids.remoteHash;
	ids.localBranch = ids.localBranch || ids.localHash;

	// try to find matching tags:
	const localTag = getTagForCommit(ids.localHash, refs);
	const remoteTag = getTagForCommit(ids.remoteHash, refs);
	ids.tagOrLocalHash = localTag || ids.localHash;
	ids.tagOrRemoteHash = remoteTag || ids.remoteHash;
	ids.tagOrBranch = remoteTag || localTag || ids.remoteBranch;

	if(msg){
		msg = 'The URL might be invalid: ' + msg;
	}

	return {
		msg: msg,
		commitIds: ids
	};
}


function getTagForCommit(commit: string, refs: git.Ref[]): string|null {
	for(const ref of refs){
		if(ref.type === git.RefType.Tag && ref.commit === commit){
			return ref.name;
		}
	}
	return null;
}

