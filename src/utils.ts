
import * as vscode from 'vscode';




export function fillTemplate(template: string, vars: {[key: string]: string|number}): string {
    console.log('filling: ' + template);

    

    for(const key in vars){
        const val = (vars[key] || '').toString();
        template = template.split('${' + key + '}').join(val); // mimic .replaceAll()
    }
    console.log('filled: ' + template);
    return template;
}


export function config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('githubLinker');
}


export interface SearchReplacePattern {
    search: string;
    replace: string;
}

