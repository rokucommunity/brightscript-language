import * as rpc from 'vscode-jsonrpc';
import * as path from 'path';
import {
    CompletionItem,
    CompletionItemKind,
    Connection,
    createConnection,
    Diagnostic,
    DiagnosticSeverity,
    DidChangeConfigurationNotification,
    InitializeParams,
    Position,
    ProposedFeatures,
    TextDocument,
    TextDocumentPositionParams,
    TextDocuments,
    DocumentSymbol,
    InitializedParams,
    DidChangeConfigurationParams,
    DidChangeWatchedFilesParams,
    FileChangeType,
    FileEvent,
} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import { ProgramBuilder } from './ProgramBuilder';
import { Program } from './Program';

export class LanguageServer {
    constructor() {

    }
    private connection: Connection;
    private brsProgramBuilder = new ProgramBuilder();
    private hasConfigurationCapability = false;
    private serverFinishedFirstRunPromise: Promise<any>;

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

        this.connection.onDocumentSymbol

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
        this.serverFinishedFirstRunPromise = this.brsProgramBuilder.run({
            cwd: <string>params.rootPath,
            watch: false,
            skipPackage: true,
            deploy: false
        }).catch((err) => {
            //do nothing with the error...hope it's just a fluke
        });

        let clientCapabilities = params.capabilities;

        // Does the client support the `workspace/configuration` request?
        // If not, we will fall back using global settings
        this.hasConfigurationCapability = !!(clientCapabilities.workspace && !!clientCapabilities.workspace.configuration);
        this.clientHasWorkspaceFolderCapability = !!(clientCapabilities.workspace && !!clientCapabilities.workspace.workspaceFolders);

        let serverCapabilities;
        //return the capabilities of the server
        return {
            capabilities: {
                textDocumentSync: this.documents.syncKind,
                // Tell the client that the server supports code completion
                completionProvider: {
                    resolveProvider: true
                }
            }
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
                this.connection.console.log('Workspace folder change event received.');
            });
        }
        //send all diagnostics
        //send all of the initial diagnostics for the whole project
        try {
            await this.serverFinishedFirstRunPromise;
            this.connection.sendNotification('build-status', `success`);
        } catch (e) {
            //send a message explaining what went wrong
            this.connection.sendNotification('critical-failure', `BrightScript language server failed to start: \n${e.message}`);
        }
        this.sendDiagnostics();
    }

    /**
     * Provide a list of completion items based on the current cursor position
     * @param textDocumentPosition
     */
    private async onCompletion(textDocumentPosition: TextDocumentPositionParams) {
        //wait for the program to load
        await this.serverFinishedFirstRunPromise;

        let completions = this.brsProgramBuilder.program.getCompletions(
            this.getPathFromUri(textDocumentPosition.textDocument.uri),
            textDocumentPosition.position
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
        let filePaths = params.changes.map((change) => {
            return path.normalize(Uri.parse(change.uri).fsPath);
        });

        //sync the program with this list of files
        await this.brsProgramBuilder.syncFiles(filePaths);

        //revalidate the program
        await this.brsProgramBuilder.program.validate();

        //send all diagnostics to the client
        this.sendDiagnostics();
        this.connection.sendNotification('build-status', 'success');
    }

    private async validateTextDocument(textDocument: TextDocument): Promise<void> {
        this.connection.sendNotification('build-status', 'building');

        //make sure the server has finished loading
        await this.serverFinishedFirstRunPromise;
        let filePath = Uri.parse(textDocument.uri).fsPath;
        await this.brsProgramBuilder.program.loadOrReloadFile(filePath, textDocument.getText());
        await this.brsProgramBuilder.program.validate();
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

        //make a bucket for every file in the project
        for (let filePath in this.brsProgramBuilder.program.files) {
            issuesByFile[filePath] = [];
        }

        for (let error of this.brsProgramBuilder.program.errors) {
            issuesByFile[error.file.pathAbsolute].push({
                severity: error.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
                range: {
                    start: Position.create(error.lineIndex, error.columnIndexBegin),
                    end: Position.create(error.lineIndex, error.columnIndexEnd)
                },
                message: error.message,
                //code: 'NO CODE',
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
        this.latestDiagnosticsByFile = issuesByFile;
    }

    getPathFromUri(uri: string) {
        return path.normalize(Uri.parse(uri).fsPath);
    }
}

// The example settings
interface ExampleSettings {
    maxNumberOfProblems: number;
}
