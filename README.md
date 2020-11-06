

# Features

This extension adds commands to create and open remote links to the currently open file.
There are a number of extensions that offer similar functionality,
so I tried to focus on three areas with this extension:

* **Flexibility:**
User configurable regular expressions and template strings to parse/modify/create urls
* **Small Footprint:**
Only depends on the default vscode.git extension
* **Inverse functionality:**
Try to parse the clipboard content and open the corresponding file

# Commands

* `githubLinker.copyUrl`:
Copy a GitHub link to the currently selected file and lines.
* `githubLinker.openUrlInBrowser`:
Make a link to the currently selected file and open it in an external browser.
* `githubLinker.openFileFromUrl`:
Read the current clipboard content, try to parse it and open the corresponding file.
Is a "best guess", does not create any files or perform any git actions.

# Settings

Below is an explanation of the key settings.
There are some more settings that are described only in the settings window itself.
Each setting contains sensible defaults, that should work for "normal" repositories.

## Making remote URLs

### `githubLinker.patterns.githubLinker`
Search-Replace patterns that are applied to the remote URL when making a GitHub URL.
Search patterns are passed to `Regexp()` first!
They are applied in the same order as they are specified in the settings.
Can be used e.g. to remove the ".git" from the end of an URL 
or to convert locally defined SSH hosts to URLs.
Can also be set in a workspace to completely overwrite the URL by matching `.*`
and replacing it with the desired URL.

### `githubLinker.templates.githubLinker`
The template used to construct the GitHub URL.
Defaults to
`${repoUrl}/blob/${remoteHash}/${relativePath}${lineSpec}`.
The references `${...}` are filled using simple search and replace,
so they can only contain the following references:
* `${repoUrl}`: The base URL of the repository.
* `${relativePath}`: The relative path of the file in the repository.
* `${lineSpec}`: The line numbers that are selected, e.g. `#L3-L12`.
See below for details.
* Any of the following references to identify the commit.
If a reference cannot be found, the `remoteXXX` references fall back to their local counterpart
and branches fall back to hashes, with `${localHash}` being the last resort for most references.
Only `${remoteName}` and `${tag}` fall back to an empty string.
    * `${localBranch}`
    * `${remoteBranch}`
    * `${localHash}`
    * `${remoteHash}`
    * `${tagOrBranch}`
    * `${tagOrLocalHash}`
    * `${tagOrRemoteHash}`
    * `${remoteName}`
    * `${tag}`

### `githubLinker.templates.oneLineNumber`
The template used to construct the `${lineSpec}` used above,
when the selection contains only one line.
Can reference `${line0}`.

### `githubLinker.templates.twoLineNumbers`
The template used to construct the `${lineSpec}` used above,
when the selection spans multiple lines.
Can reference `${line0}` and `${line1}`.

## Opening files specified in the clipboard

### `githubLinker.patterns.openFiles`
Search-Replace patterns that are applied to the URL/path, when opening a file from the clipboard.
Search patterns are passed to `Regexp()` first!
They are applied in the same order as they are specified in the settings.
It is expected that only the path of the file and the optional line numbers remain after replacing these patterns.
The path is considered either as absolute path, relative to the workspace folder(s),
or relative to the repository root(s).
The first combination that yields an existing file is opened in a new editor.

### `githubLinker.patterns.lineNumbers`
The `Regexp()` patterns used to identify line numbers that are selected after opening the file.
Should contain one or two capture groups.
The patterns are used in the same order as they are specified in the config.
The first matching pattern is replaced with an empty string,
its first capture group (if present) is considered as the first line number in the selection,
and the second capture group (if present) is considered as the last number in the selection.

