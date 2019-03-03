import {
    CompletionItem,
    Connection,
    createConnection,
    Diagnostic,
    DidChangeConfigurationNotification,
    DidChangeConfigurationParams,
    DidChangeWatchedFilesParams,
    Hover,
    InitializedParams,
    InitializeParams,
    ProposedFeatures,
    ServerCapabilities,
    TextDocument,
    TextDocumentPositionParams,
    TextDocuments,
} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import { ProgramBuilder } from './ProgramBuilder';
import util from './util';

export class LanguageServer {
    constructor() {

    }
    private connection: Connection;

    private workspaces = [] as Array<{
        firstRunPromise: Promise<any>;
        builder: ProgramBuilder;
        workspacePath: string;
    }>;

    private hasConfigurationCapability = false;

    /**
     * Indicates whether the client supports workspace folders
     */
    private clientHasWorkspaceFolderCapability = false;

    /**
     * Create a simple text document manager.
     * The text document manager supports full document sync only
     */
    private documents = new TextDocuments();

    //run the server
    public run() {
        // Create a connection for the server. The connection uses Node's IPC as a transport.
        // Also include all preview / proposed LSP features.
        this.connection = createConnection(ProposedFeatures.all);

        this.connection.onInitialize(this.onInitialize.bind(this));

        this.connection.onInitialized(this.onInitialized.bind(this));

        this.connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));

        this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));

        // The content of a text document has changed. This event is emitted
        // when the text document is first opened, when its content has changed,
        // or when document is closed without saving (original contents are sent as a change)
        //
        this.documents.onDidChangeContent(async (change) => {
            await this.validateTextDocument(change.document);
        });

        // This handler provides the initial list of the completion items.
        this.connection.onCompletion(this.onCompletion.bind(this));

        // This handler resolves additional information for the item selected in
        // the completion list.
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));

        this.connection.onHover(this.onHover.bind(this));

        /*
       this.connection.onDidOpenTextDocument((params) => {
            // A text document got opened in VSCode.
            // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
            // params.text the initial full content of the document.
           this.connection.console.log(`${params.textDocument.uri} opened.`);
        });
       this.connection.onDidChangeTextDocument((params) => {
            // The content of a text document did change in VSCode.
            // params.uri uniquely identifies the document.
            // params.contentChanges describe the content changes to the document.
           this.connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
        });
       this.connection.onDidCloseTextDocument((params) => {
            // A text document got closed in VSCode.
            // params.uri uniquely identifies the document.
           this.connection.console.log(`${params.textDocument.uri} closed.`);
        });
        */

        // listen for open, change and close text document events
        this.documents.listen(this.connection);

        // Listen on the connection
        this.connection.listen();
    }

    /**
     * Called when the client starts initialization
     * @param params
     */
    private async onInitialize(params: InitializeParams) {
        //start up a new BrightScript program builder in watch mode,
        //disable all output file generation and deployments, as this
        //is purely for the language server options
        let workspacePaths = params.workspaceFolders.map((x) => {
            return util.getPathFromUri(x.uri);
        });
        if (workspacePaths.length === 0) {
            workspacePaths.push(util.getPathFromUri(params.rootUri));
        }
        this.createWorkspaces(workspacePaths);

        let clientCapabilities = params.capabilities;

        // Does the client support the `workspace/configuration` request?
        // If not, we will fall back using global settings
        this.hasConfigurationCapability = !!(clientCapabilities.workspace && !!clientCapabilities.workspace.configuration);
        this.clientHasWorkspaceFolderCapability = !!(clientCapabilities.workspace && !!clientCapabilities.workspace.workspaceFolders);

        //return the capabilities of the server
        return {
            capabilities: {
                textDocumentSync: this.documents.syncKind,
                // Tell the client that the server supports code completion
                completionProvider: {
                    resolveProvider: true
                },
                hoverProvider: true
            } as ServerCapabilities
        };
    }

    /**
     * Called when the client has finished initializing
     * @param params
     */
    private async onInitialized(params: InitializedParams) {
        if (this.hasConfigurationCapability) {
            // Register for all configuration changes.
            this.connection.client.register(
                DidChangeConfigurationNotification.type,
                undefined
            );
        }
        if (this.clientHasWorkspaceFolderCapability) {
            this.connection.workspace.onDidChangeWorkspaceFolders((evt) => {
                for (let removed of evt.removed) {
                    let workspacePath = util.getPathFromUri(removed.uri);
                    let workspace = this.workspaces.find((x) => x.workspacePath === workspacePath);
                    if (workspace) {
                        workspace.builder.dispose();
                        this.workspaces.splice(this.workspaces.indexOf(workspace), 1);
                    }
                }
                this.createWorkspaces(evt.added.map((x) => util.getPathFromUri(x.uri)));
                this.connection.console.log('Workspace folder change event received.');
            });
        }
        //send all diagnostics
        //send all of the initial diagnostics for the whole project
        try {
            await this.waitAllProgramFirstRuns();
            this.connection.sendNotification('build-status', `success`);
        } catch (e) {
            //send a message explaining what went wrong
            this.connection.sendNotification('critical-failure', `BrightScript language server failed to start: \n${e.message}`);
        }
        this.sendDiagnostics();
    }

    /**
     * Wait for all programs' first run to complete
     */
    private async waitAllProgramFirstRuns() {
        await Promise.all(this.workspaces.map((x) => x.firstRunPromise));
    }

    /**
     * Create project for each new workspace. If the workspace is already known,
     * it is skipped.
     * @param workspaceFolders
     */
    private createWorkspaces(workspacePaths: string[]) {
        for (let workspacePath of workspacePaths) {
            let workspace = this.workspaces.find((x) => x.workspacePath === workspacePath);
            //skip this workspace if we already have it
            if (workspace) {
                continue;
            }
            let builder = new ProgramBuilder();
            let firstRunPromise = builder.run({
                cwd: <string>workspacePath,
                watch: false,
                skipPackage: true,
                deploy: false
            }).catch((err) => {
                console.error(err);
            });
            this.workspaces.push({
                builder: builder,
                firstRunPromise: firstRunPromise,
                workspacePath: workspacePath
            });
        }
    }

    /**
     * Provide a list of completion items based on the current cursor position
     * @param textDocumentPosition
     */
    private async onCompletion(textDocumentPosition: TextDocumentPositionParams) {
        //wait for the program to load
        await this.waitAllProgramFirstRuns();
        let filePath = util.getPathFromUri(textDocumentPosition.textDocument.uri);

        let completions = Array.prototype.concat.apply([],
            this.workspaces.map((x) => {
                if (x.builder.program.hasFile(filePath)) {
                    return x.builder.program.getCompletions(filePath, textDocumentPosition.position);
                }
            })
        ) as CompletionItem[];

        let result = [] as CompletionItem[];
        for (let completion of completions) {
            result.push(completion);
        }
        return result;
    }

    /**
     * Provide a full completion item from the selection
     * @param item
     */
    private onCompletionResolve(item: CompletionItem): CompletionItem {
        if (item.data === 1) {
            (item.detail = 'TypeScript details'),
                (item.documentation = 'TypeScript documentation');
        } else if (item.data === 2) {
            (item.detail = 'JavaScript details'),
                (item.documentation = 'JavaScript documentation');
        }
        return item;
    }

    private onDidChangeConfiguration(change: DidChangeConfigurationParams) {
        //TODO implement some settings? Perhaps the location of brsconfig.json?

        // if (this.hasConfigurationCapability) {
        //     // Reset all cached document settings
        //     this.documentSettings.clear();
        // } else {
        //     this.globalSettings = <ExampleSettings>(
        //         (change.settings.languageServerExample || this.defaultSettings)
        //     );
        // }

        // // Revalidate all open text documents
        // this.documents.all().forEach(this.validateTextDocument);
    }

    /**
     * Called when watched files changed (add/change/delete).
     * The client is in charge of what files to watch, so all client
     * implementations should ensure that all valid brightscript project
     * file types are watched (.brs,.bs,.xml,manifest, and any json/text/image files)
     * @param params
     */
    private async onDidChangeWatchedFiles(params: DidChangeWatchedFilesParams) {
        this.connection.sendNotification('build-status', 'building');

        await Promise.all(
            this.workspaces.map((x) => x.builder.handleFileChanges(params.changes))
        );

        //revalidate the program
        await Promise.all(
            this.workspaces.map((x) => x.builder.program.validate())
        );

        //send all diagnostics to the client
        this.sendDiagnostics();
        this.connection.sendNotification('build-status', 'success');
    }

    private onHover(params: TextDocumentPositionParams) {
        let pathAbsolute = util.getPathFromUri(params.textDocument.uri);
        let hovers = Array.prototype.concat.call([],
            this.workspaces.map((x) => x.builder.program.getHover(pathAbsolute, params.position))
        ) as Hover[];

        //for now, just return the first hover found. TODO handle multiple hover results
        let hover = hovers[0];

        //TODO improve this to support more than just .brs files
        if (hover && hover.contents) {
            //create fenced code block to get colorization
            hover.contents = '```brightscript\n' + hover.contents + '```';
        }
        return hover;
    }

    private async validateTextDocument(textDocument: TextDocument): Promise<void> {
        this.connection.sendNotification('build-status', 'building');

        //make sure the server has finished loading
        await this.waitAllProgramFirstRuns();
        let filePath = Uri.parse(textDocument.uri).fsPath;
        let documentText = textDocument.getText();
        await Promise.all(
            this.workspaces.map((x) => {
                //only add or replace existing files. All of the files in the project should
                //have already been loaded by other means
                if (x.builder.program.hasFile(filePath)) {
                    return x.builder.program.addOrReplaceFile(filePath, documentText);
                }
            })
        );
        await Promise.all(
            this.workspaces.map((x) => x.builder.program.validate())
        );
        this.sendDiagnostics();
        this.connection.sendNotification('build-status', 'success');
    }

    /**
     * The list of all issues, indexed by file. This allows us to keep track of which buckets of
     * diagnostics to send and which to skip because nothing has changed
     */
    private latestDiagnosticsByFile = {} as { [key: string]: Diagnostic[] };
    private sendDiagnostics() {
        //compute the new list of diagnostics for whole project
        let issuesByFile = {} as { [key: string]: Diagnostic[] };
        // let uri = Uri.parse(textDocument.uri);

        //make a bucket for every file in every project
        for (let workspace of this.workspaces) {
            for (let filePath in workspace.builder.program.files) {
                issuesByFile[filePath] = [];
            }
        }

        let diagnostics = Array.prototype.concat.apply([],
            this.workspaces.map((x) => x.builder.program.getDiagnostics())
        );

        for (let diagnostic of diagnostics) {
            issuesByFile[diagnostic.file.pathAbsolute].push({
                severity: util.severityToDiagnostic(diagnostic.severity),
                range: diagnostic.location,
                message: diagnostic.message,
                code: diagnostic.code,
                source: 'brs'
            });
        }

        //send all diagnostics
        for (let filePath in issuesByFile) {
            //TODO filter by only the files that have changed
            this.connection.sendDiagnostics({
                uri: Uri.file(filePath).toString(),
                diagnostics: issuesByFile[filePath]
            });
        }

        //clear any diagnostics for files that are no longer present
        let currentFilePaths = Object.keys(issuesByFile);
        for (let filePath in this.latestDiagnosticsByFile) {
            if (currentFilePaths.indexOf(filePath) === -1) {
                this.connection.sendDiagnostics({
                    uri: Uri.file(filePath).toString(),
                    diagnostics: []
                });
            }
        }

        //save the new list of diagnostics
        this.latestDiagnosticsByFile = issuesByFile;
    }
}
