const vscode = require("vscode");

class SidebarProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "projectToFile":
                    vscode.commands.executeCommand("llm-project-tools.projectToFile");
                    return;
                case "activeWindowToFile":
                    vscode.commands.executeCommand("llm-project-tools.activeWindowToFile");
                    return;
                case "generateReadme":
                    vscode.commands.executeCommand("llm-project-tools.generateReadme");

                case "showChart":
                    vscode.commands.executeCommand("auto-docs.showChart");
                case "showActiveProjectFlowchart":
                    vscode.commands.executeCommand("auto-docs.showActiveProjectFlowchart");
                    return;
            }
        });
    }

    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.js"),
        );

        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
        );
        
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
    

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            
            <link href="${codiconsUri}" rel="stylesheet" />
            <link href="${styleMainUri}" rel="stylesheet">
            
            <title>Auto-Doc</title>
        </head>
        <body>
            <div class="header">
                <h3>Auto-Doc</h3>
            </div>

            <div class="action-group">
                <h4><i class="codicon codicon-book"></i> Documentation</h4>
                <button class="action-button" id="project-btn">
                    <i class="codicon codicon-folder-library"></i>
                    <span>Project Docs</span>
                </button>
                <button class="action-button" id="window-btn">
                    <i class="codicon codicon-go-to-file"></i>
                    <span>Active File Docs</span>
                </button>
                <button class="action-button" id="readme-btn">
                    <i class="codicon codicon-markdown"></i>
                    <span>Generate README.md</span>
                </button>
            </div>

            <div class="action-group">
                <h4><i class="codicon codicon-symbol-class"></i> Visualizations</h4>
                <button class="action-button" id="activeTab-flow-btn">
                    <i class="codicon codicon-symbol-method"></i>
                    <span>Active File Flowchart</span>
                </button>
                <button class="action-button" id="create-flow-btn">
                     <i class="codicon codicon-project"></i>
                    <span>Project Flowchart</span>
                </button>
            </div>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

module.exports = SidebarProvider;
