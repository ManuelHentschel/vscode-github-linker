
import * as vscode from 'vscode';


export function fillTemplate(template: string, vars: {[key: string]: string|number}): string {
    for(const key in vars){
        const val = (vars[key] || '').toString();
        template = template.split('${' + key + '}').join(val); // mimic .replaceAll()
    }
    return template;
}


export function config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('githubLinker');
}


export interface SearchReplacePattern {
    search: string;
    replace: string;
}

// helper function, used to abort the url-creation if e.g. no repo is found
export function assert(condition: any, message: string = 'Assertion failed!'): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}
