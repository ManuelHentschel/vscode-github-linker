
import * as vscode from 'vscode';
import * as path from 'path';

// Import the declaration of the git API:
import * as git from './git';
import * as fs from 'fs';

import { config, SearchReplacePattern } from './utils';

// contains info about the content of a url/filepath
interface IParsedUrl {
    errorCode: 0 | 1; // return code of parsing the url
    path?: string; // only missing if errorCode != 0
    line0?: number; // sometimes missing -> 0
    line1?: number; // sometimes missing -> 0
    msg?: string; // only relevant if errorCode != 0
    originalUrl: string;
}
interface ParsedUrlOk extends IParsedUrl {
    errorCode: 0;
    path: string;
    line0: number;
    line1: number;
}
interface ParsedUrlFail extends IParsedUrl {
    errorCode: 1;
    msg: string;
}
type ParsedUrl = ParsedUrlOk | ParsedUrlFail;

// main function
export async function openFileFromClipboardUrl(){
    const url = await vscode.env.clipboard.readText();
    const parsedUrl = parseUrl(url);
    const checkedUrl = checkPath(parsedUrl);
    openFileFromUrl(checkedUrl);
}


function parseUrl(url: string): ParsedUrlOk {

    // read settings
    const patterns = config().get<SearchReplacePattern[]>('patterns.openFiles', []);
    const lineSpecs = config().get<string[]>('patterns.lineNumbers', []);
    const url0 = url;

    // apply search-replace patterns to url/path
	for (const pattern of patterns) {
		const re = new RegExp(pattern.search);
		url = url.replace(re, pattern.replace);
    }

    // parse line numbers, using the first lineSpec that matches
    let line0: number = 0;
    let line1: number = 0;
    for(const lineSpec of lineSpecs){
        const re = new RegExp(lineSpec);
        const m = url.match(re);
        if(m){
            url = url.replace(re, '');
            if(m.length === 2){
                line0 = parseInt(m[1]);
                line1 = parseInt(m[1]);
            } else if(m.length>=3){
                line0 = parseInt(m[1]);
                line1 = parseInt(m[2]);
            }
            break;
        }
    }
    
    const ret: ParsedUrlOk = {
        errorCode: 0,
        path: url,
        line0: line0,
        line1: line1,
        originalUrl: url0
    };

    return ret;
}


// check if the path points to an existing file (if absolute path)
// or combine with workspaceFolders and repoRoots to make an existing path
function checkPath(parsedUrl: ParsedUrlOk): ParsedUrl {
    
    // if(!ret.path){}
    
    const possiblePaths: string[] = [];
    if(path.isAbsolute(parsedUrl.path)){
        possiblePaths.push(parsedUrl.path);
    }
    for(const folder of vscode.workspace.workspaceFolders || []){
        possiblePaths.push(path.join(folder.uri.fsPath, parsedUrl.path));
    }
    const repos = getRepos();
    for(const repo of repos){
        possiblePaths.push(path.join(repo.rootUri.fsPath, parsedUrl.path));
    }

    for(const filePath of possiblePaths){
        if(fs.existsSync(filePath) && fs.statSync(filePath).isFile()){
            parsedUrl.path = filePath;
            parsedUrl.errorCode = 0;
            return parsedUrl;
        }
    }
    
    const checkedUrl: ParsedUrlFail = {
        ...parsedUrl,
        errorCode: 1,
        msg: `File not found: ${parsedUrl.path}`
    };

    return checkedUrl;
}


// actually open an editor with the file from the clipboard
async function openFileFromUrl(parsedUrl: ParsedUrl): Promise<vscode.TextEditor | null> {
    // errorCode>0 -> could not find a matching file
    if(parsedUrl.errorCode){
        const msg = parsedUrl.msg || 'File not found: ' + parsedUrl.originalUrl;
        vscode.window.showWarningMessage(msg);
        return null;
    }

    // errorCode==0 -> open file
    const uri = vscode.Uri.file(parsedUrl.path);
    const doc = await vscode.window.showTextDocument(uri);
    if(parsedUrl.line0){
        // scroll to the line numbers given in the url/path
        const pos0 = new vscode.Position(parsedUrl.line0-1, 0);
        const pos1 = new vscode.Position(parsedUrl.line1, 0);
        const selection = new vscode.Selection(pos0, pos1);
        doc.selections = [selection];
        doc.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    return doc;
}


// get the repo of the active file form vscode's git extension api
function getRepos(): git.Repository[] {
	// get git api
    const gitExtension = vscode.extensions.getExtension<git.GitExtension>('vscode.git');
    if(!gitExtension || !gitExtension.isActive){
        return [];
    }
	const api = gitExtension.exports.getAPI(1);
	return api.repositories;
}
