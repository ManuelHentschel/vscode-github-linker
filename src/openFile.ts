
import * as vscode from 'vscode';
import * as path from 'path';

// Import the declaration of the git API:
import * as git from './git';
import * as fs from 'fs';

import { config, SearchReplacePattern } from './utils';

// contains info about the content of a url/filepath
interface ParsedUrl {
    errorCode: number; // return code of parsing the url
    path?: string; // only missing if errorCode != 0
    line0?: number; // sometimes missing -> 0
    line1?: number; // sometimes missing -> 0
    msg?: string; // only relevant if errorCode != 0
    originalUrl?: string; // only used in error reporting
}

// main function
export async function openFileFromClipboardUrl(){
    const url = await vscode.env.clipboard.readText();
    let parsedUrl = parseUrl(url);
    parsedUrl = checkPath(parsedUrl);
    openFileFromUrl(parsedUrl);
}


function parseUrl(url: string): ParsedUrl {
    // prep return value
    let ret: ParsedUrl = {
        errorCode: 0,
        originalUrl: url,
        line0: 0,
        line1: 0
    };

    // read settings
    const patterns = config().get<SearchReplacePattern[]>('patterns.openFiles', []);
    const lineSpecs = config().get<string[]>('patterns.lineNumbers', []);

    // apply search-replace patterns to url/path
	for (const pattern of patterns) {
		const re = new RegExp(pattern.search);
		url = url.replace(re, pattern.replace);
    }

    // parse line numbers, using the first lineSpec that matches
    for(const lineSpec of lineSpecs){
        const re = new RegExp(lineSpec);
        const m = url.match(re);
        if(m){
            url = url.replace(re, '');
            if(m.length === 2){
                ret.line0 = parseInt(m[1]);
                ret.line1 = parseInt(m[1]);
            } else if(m.length>=3){
                ret.line0 = parseInt(m[1]);
                ret.line1 = parseInt(m[2]);
            }
            break;
        }
    }

    ret.path = url;

    return ret;
}


// check if the path points to an existing file (if absolute path)
// or combine with workspaceFolders and repoRoots to make an existing path
function checkPath(ret: ParsedUrl): ParsedUrl {
    
    const possiblePaths = [];
    if(path.isAbsolute(ret.path)){
        possiblePaths.push(ret.path);
    }
    for(const folder of vscode.workspace.workspaceFolders){
        possiblePaths.push(path.join(folder.uri.fsPath, ret.path));
    }
    const repos = getRepos();
    for(const repo of repos){
        possiblePaths.push(path.join(repo.rootUri.fsPath, ret.path));
    }

    for(const filePath of possiblePaths){
        if(fs.existsSync(filePath) && fs.statSync(filePath).isFile()){
            ret.path = filePath;
            ret.errorCode = 0;
            return ret;
        }
    }

    ret.errorCode = 1;
    ret.msg = `File not found: ${ret.path}`;

    return ret;
}


// actually open an editor with the file from the clipboard
async function openFileFromUrl(parsedUrl: ParsedUrl): Promise<vscode.TextEditor> | null{
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
