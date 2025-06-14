(function () {
    const vscode = acquireVsCodeApi();

    document.getElementById("project-btn").addEventListener("click", () => {
        vscode.postMessage({ command: "projectToFile" });
    });

    document.getElementById("window-btn").addEventListener("click", () => {
        vscode.postMessage({ command: "activeWindowToFile" });
    });

    document.getElementById("readme-btn").addEventListener("click", () => {
        vscode.postMessage({ command: "generateReadme" });
    });
    document.getElementById("create-flow-btn").addEventListener("click", () => {
        vscode.postMessage({ command: "showChart" });
    });
    document.getElementById("activeTab-flow-btn").addEventListener("click", () => {
        vscode.postMessage({ command: "showActiveProjectFlowchart" });
    });
})();
