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
                    vscode.commands.executeCommand(
                        "llm-project-tools.projectToFile"
                    );
                    return;
                case "activeWindowToFile":
                    vscode.commands.executeCommand(
                        "llm-project-tools.activeWindowToFile"
                    );
                    return;
                case "generateReadme":
                    vscode.commands.executeCommand(
                        "llm-project-tools.generateReadme"
                    );

                case "showChart":
                    vscode.commands.executeCommand(
                        "auto-docs.showChart"
                    );
                case 'showActiveProjectFlowchart':
                    vscode.commands.executeCommand(
                        "auto-docs.showActiveProjectFlowchart"
                    );
                return;
            }
        });
    }

    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
        );

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>AUTO-DOC</title>
            </head>
            <body>
                <button class="action-button" id="project-btn">Project Doc</button>
                <button class="action-button" id="window-btn">Active Tab Doc</button>
                <button class="action-button" id="activeTab-flow-btn">Active Tab Flow</button>
                <button class="action-button" id="create-flow-btn">Get Flow Chart</button>
                <button class="action-button" id="readme-btn">Get README.md</button>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

module.exports = SidebarProvider;
