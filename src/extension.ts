import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonExecutionService } from './pythonExecutionService';

let pythonExecutionService: PythonExecutionService;
let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    pythonExecutionService = new PythonExecutionService(context);

    const generateDependencyGraph = vscode.commands.registerCommand(
        'dependencyGraph.generateGraph',
        async () => {
            const repoPath = vscode.workspace.workspaceFolders?.[0];
            if (!repoPath) {
                vscode.window.showErrorMessage('Please open a workspace folder first!');
                return;
            }

            const outputPath = path.join(repoPath.uri.fsPath, 'dependency_graph.html');
            const scriptPath = path.resolve(__dirname, '../app/main.py');
            
            try {
                await pythonExecutionService.runPythonScript(scriptPath, [repoPath.uri.fsPath, outputPath]);
                vscode.window.showInformationMessage(`Dependency graph generated successfully`);
                await createOrShowWebview(context.extensionUri, outputPath, context);
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        }
    );

    context.subscriptions.push(generateDependencyGraph);
}

function getWebviewContent(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, htmlPath: string): string {
    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Generate webview-compatible URIs for styles and scripts
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'app', 'templates', 'page_template', 'styles.css'));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'app', 'templates', 'page_template', 'functions.js'));

    // Set secure resource roots
    panel.webview.options = {
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'app', 'templates', 'page_template'),
            vscode.Uri.file(path.dirname(htmlPath))
        ],
        enableScripts: true
    };

    // Replace placeholders in the HTML template
    htmlContent = htmlContent.replace("{styles_path}", styleUri.toString());
    htmlContent = htmlContent.replace("{functions_path}", scriptUri.toString());

    // Write the HTML file to the active directory
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    return htmlContent;
}

async function openFile(filePath: string): Promise<void> {
    try {
        const vscodeUri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('vscode.open', vscodeUri, { viewColumn: vscode.ViewColumn.Beside });
        console.log("File opened successfully:", filePath);
    } catch (error) {
        console.error("Error opening file:", error);
        vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
    }
}

async function createOrShowWebview(
    extensionUri: vscode.Uri, 
    outputPath: string, 
    context: vscode.ExtensionContext
): Promise<void> {
    if (currentPanel) {
        // Update existing panel
        currentPanel.reveal(vscode.ViewColumn.Beside);
        currentPanel.webview.html = getWebviewContent(currentPanel, extensionUri, outputPath);
    } else {
        // Create new panel
        currentPanel = vscode.window.createWebviewPanel(
            'dependencyGraph',
            'Dependency Graph',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.dirname(outputPath)),
                    vscode.Uri.joinPath(extensionUri, 'app', 'templates', 'page_template')
                ]
            }
        );

        // Set up message handler
        currentPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'openFile':
                        await openFile(message.filePath);
                        // Send confirmation back to webview
                        currentPanel?.webview.postMessage({ 
                            command: 'fileOpened',
                            filePath: message.filePath
                        });
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        currentPanel.webview.html = getWebviewContent(currentPanel, extensionUri, outputPath);

        // Clean up resources when panel is closed
        currentPanel.onDidDispose(
            () => {
                currentPanel = undefined;
            },
            null,
            context.subscriptions
        );
    }
}

export function deactivate() {
    if (currentPanel) {
        currentPanel.dispose();
    }
}