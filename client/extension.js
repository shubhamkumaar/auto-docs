const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const ignore = require("ignore");
const axios = require("axios");
const SidebarProvider = require("./sidebarProvider");

const ALLOWED_EXTENSIONS = new Set([
    ".tsx",
    ".jsx",
    ".ts",
    ".js",
    ".md",
    ".py",
    ".html",
    ".c",
    ".cpp",
    ".java",
    ".go",
    ".sh",
]);

const FILES_TO_IGNORE = new Set(["package-lock.json"]);
const OUTPUT_FOLDER_NAME = "auto-docs-output";
const API_DELAY_MS = 250;

function activate(context) {
    console.log("Congratulations, your extension is now active!");

    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("llm-tools-sidebar", sidebarProvider),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("llm-project-tools.projectToFile", projectToFileCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "llm-project-tools.activeWindowToFile",
            activeWindowToFileCommand,
        ),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("llm-project-tools.generateReadme", generateReadmeCommand),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("auto-docs.showChart", () => {
            showChartCommand(context);
        }),
    );
    context.subscriptions.push(
        // This is the updated command logic.
        vscode.commands.registerCommand("auto-docs.showActiveProjectFlowchart", () => {
            showFlowchartForActiveFileCommand(context);
        }),
    );
}

async function showFlowchartForActiveFileCommand(context) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("Please open a project folder.");
        return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
    const outputDir = path.join(projectRoot, OUTPUT_FOLDER_NAME);
    const activeFilePath = activeEditor.document.uri.fsPath;

    if (!fs.existsSync(outputDir)) {
        vscode.window.showErrorMessage(
            `Output directory "${OUTPUT_FOLDER_NAME}" not found. Please run the "Generate Project Documentation" command first.`,
        );
        return;
    }

    if (activeFilePath.includes(outputDir)) {
        vscode.window.showInformationMessage(
            "This is already a generated file. Open a source code file (e.g., app.ts) to see its flowchart.",
        );
        return;
    }

    try {
        const relativePath = path.relative(projectRoot, activeFilePath);
        const safeFileName = relativePath.replace(/[\\/]/g, "_");
        const targetJsonFileName = `${safeFileName}.json`;
        const targetJsonPath = path.join(outputDir, targetJsonFileName);

        if (!fs.existsSync(targetJsonPath)) {
            vscode.window.showErrorMessage(
                `Flowchart for "${relativePath}" not found. Please run the "Generate Project Documentation" command.`,
            );
            return;
        }

        const fileContent = fs.readFileSync(targetJsonPath, "utf8");
        const jsonData = JSON.parse(fileContent);

        if (
            !jsonData.FlowChart ||
            typeof jsonData.FlowChart !== "string" ||
            jsonData.FlowChart.trim() === ""
        ) {
            vscode.window.showErrorMessage(
                `The file "${targetJsonFileName}" does not contain a valid flowchart.`,
            );
            return;
        }

        const mermaidCode = jsonData.FlowChart;

        const panel = vscode.window.createWebviewPanel(
            "activeFlowchart",
            `Flowchart: ${relativePath}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "media"))],
            },
        );

        const mermaidUri = panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(context.extensionPath, "media", "mermaid.min.js")),
        );

        const panzoomUri = panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(context.extensionPath, "media", "panzoom.min.js")),
        );

        panel.webview.html = getZoomableWebviewContent(mermaidUri, panzoomUri, mermaidCode);
    } catch (error) {
        console.error("Error showing active flowchart:", error);
        vscode.window.showErrorMessage(`An error occurred: ${error.message}`);
    }
}

function getZoomableWebviewContent(mermaidUri, panzoomUri, mermaidCode) {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Flowchart Viewer</title>
      <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #222; }
        #scene { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: move; }
        .mermaid { background-color: white; padding: 20px; border-radius: 8px; }
      </style>
  </head>
  <body>
    <div id="scene">
        <div class="mermaid">
            ${mermaidCode}
        </div>
    </div>
    <script src="${mermaidUri}"></script>
    <script src="${panzoomUri}"></script>
    <script>
      mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
      setTimeout(() => {
        mermaid.contentLoaded();
        const scene = document.querySelector('#scene');
        const mermaidDiv = document.querySelector('.mermaid');
        if (scene && mermaidDiv) {
            const pz = Panzoom(mermaidDiv, { maxScale: 5, minScale: 0.3, canvas: true });
            scene.addEventListener('wheel', pz.zoomWithWheel);
        }
      }, 300);
    </script>
  </body>
  </html>`;
}

async function showChartCommand(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No project folder is open.");
        return;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;
    const projectName = path.basename(projectRoot);
    const summaryFileName = `${projectName}.json`;
    const summaryFilePath = path.join(projectRoot, OUTPUT_FOLDER_NAME, summaryFileName);
    const chartCacheFilePath = path.join(
        projectRoot,
        OUTPUT_FOLDER_NAME,
        `${projectName}_chart.json`,
    );

    if (!fs.existsSync(summaryFilePath)) {
        vscode.window.showErrorMessage(
            `File not found: ${summaryFileName}. Please run the "Generate Project Documentation" command first.`,
        );
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "📊 Generating Flowchart...",
            cancellable: false,
        },
        async (progress) => {
            try {
                progress.report({ message: "Reading project summary..." });
                const summaryFileContent = fs.readFileSync(summaryFilePath, "utf8");
                const projectData = JSON.parse(summaryFileContent);

                let chartData;

                if (fs.existsSync(chartCacheFilePath)) {
                    progress.report({ message: "Loading chart from cache..." });
                    const cachedContent = fs.readFileSync(chartCacheFilePath, "utf8");
                    chartData = JSON.parse(cachedContent);
                } else {
                    progress.report({ message: "Calling backend API..." });
                    const response = await axios.post(
                        "http://ad.shub0.me/api/chart",
                        projectData,
                    );
                    chartData = response.data;

                    fs.writeFileSync(
                        chartCacheFilePath,
                        JSON.stringify(chartData, null, 2),
                        "utf8",
                    );
                }

                const mermaidCode = chartData.flowchart;

                const panel = vscode.window.createWebviewPanel(
                    "activeFlowchart",
                    `Flowchart: ${projectData}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        localResourceRoots: [
                            vscode.Uri.file(path.join(context.extensionPath, "media")),
                        ],
                    },
                );

                const mermaidUri = panel.webview.asWebviewUri(
                    vscode.Uri.file(path.join(context.extensionPath, "media", "mermaid.min.js")),
                );

                const panzoomUri = panel.webview.asWebviewUri(
                    vscode.Uri.file(path.join(context.extensionPath, "media", "panzoom.min.js")),
                );

                panel.webview.html = getZoomableWebviewContent(mermaidUri, panzoomUri, mermaidCode);
                vscode.window.showInformationMessage("✅ Flowchart data ready.");
            } catch (error) {
                console.error("Error generating Flowchart:", error);
                const errorMessage = error.response?.data?.error || error.message;
                vscode.window.showErrorMessage(`Failed to generate Flowchart: ${errorMessage}`);
            }
        },
    );
}

async function generateReadmeCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No project folder is open.");
        return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
    const projectName = path.basename(projectRoot);
    const summaryFileName = `${projectName}.json`;
    const summaryFilePath = path.join(projectRoot, OUTPUT_FOLDER_NAME, summaryFileName);

    if (!fs.existsSync(summaryFilePath)) {
        vscode.window.showErrorMessage(
            `File not found: ${summaryFileName}. Please run the "Generate Project Documentation" command first.`,
        );
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "🤖 Generating README.md with AI...",
            cancellable: false,
        },
        async (progress) => {
            try {
                progress.report({ message: "Reading project summary..." });
                const summaryFileContent = fs.readFileSync(summaryFilePath, "utf8");
                const projectData = JSON.parse(summaryFileContent);

                progress.report({ message: "Calling backend API..." });
                const response = await axios.post("http://ad.shub0.me/api/readme", projectData);
                // console.log(response);
                if (!response.data || !response.data.markdown) {
                    throw new Error("Invalid response from the backend API.");
                }

                const readmeContent = response.data.markdown;
                const readmeOutputPath = path.join(projectRoot, "README.md");

                progress.report({ message: "Saving README.md..." });

                fs.writeFileSync(
                    readmeOutputPath,
                    readmeContent.trim().replace("```markdown", ""),
                    "utf8",
                );

                vscode.window.showInformationMessage(
                    `Successfully generated README.md in the project root.`,
                );

                const fileUri = vscode.Uri.file(readmeOutputPath);
                vscode.window.showTextDocument(fileUri);
            } catch (error) {
                console.error("Error generating README:", error);
                const errorMessage = error.response?.data?.error || error.message;
                vscode.window.showErrorMessage(`Failed to generate README: ${errorMessage}`);
            }
        },
    );
}

/**
 * Processes each file in the project, calls the backend to generate documentation,
 * saves individual JSON files, and then creates a final aggregated project summary JSON file.
 */
async function projectToFileCommand() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No project folder is open.");
        return;
    }
    const projectRoot = workspaceFolders[0].uri.fsPath;
    const projectName = path.basename(projectRoot);
    const outputDir = path.join(projectRoot, OUTPUT_FOLDER_NAME);

    createDirectory(outputDir);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `🤖 Generating Docs for ${projectName}...`,
            cancellable: true,
        },
        async (progress, token) => {
            const allApiResponses = [];
            const filesToProcess = getProjectFiles(projectRoot);
            const totalFiles = filesToProcess.length;

            if (totalFiles === 0) {
                vscode.window.showWarningMessage("No processable files found in the project.");
                return;
            }

            progress.report({
                message: "Processing individual files...",
                increment: 0,
            });
            for (let i = 0; i < totalFiles; i++) {
                if (token.isCancellationRequested) {
                    vscode.window.showInformationMessage("Documentation generation cancelled.");
                    return;
                }

                const file = filesToProcess[i];
                const increment = 100 / totalFiles / 2;
                progress.report({
                    message: `(${i + 1}/${totalFiles}) ${file.relativePath}`,
                    increment: increment,
                });
                const safeFileName = file.relativePath.replace(/[\\/]/g, "_");
                const outputFile = path.join(outputDir, `${safeFileName}.json`);
                if (fs.existsSync(outputFile)) {
                    console.log(
                        `🔁 Skipping API call: using cached response for ${file.relativePath}`,
                    );
                    const cachedResponse = JSON.parse(fs.readFileSync(outputFile, "utf8"));
                    allApiResponses.push(cachedResponse);
                    continue;
                }
                try {
                    if (file.content.trim() === "") {
                        console.warn(`Skipping empty file: ${file.relativePath}`);
                        continue;
                    }
                    const response = await axios.post("http://ad.shub0.me/api/doc/", {
                        code: file.content,
                    });
                    if (response.data) {
                        // if (response.data.code && typeof response.data.code === "string") {
                        //     let modifiedCode = response.data.code;
                        //     response.data.code = modifiedCode;
                        //     fs.writeFileSync(file.fullPath, modifiedCode, "utf8");
                        // }
                        const safeFileName = file.relativePath.replace(/[\\/]/g, "_");
                        const outputFile = path.join(outputDir, `${safeFileName}.json`);
                        fs.writeFileSync(
                            outputFile,
                            JSON.stringify(response.data, null, 2),
                            "utf8",
                        );
                        allApiResponses.push(response.data);
                    }
                } catch (apiError) {
                    const errorMessage = `Failed to process file ${file.relativePath}: ${apiError.message}`;
                    console.error(errorMessage, apiError.response?.data);
                    vscode.window.showErrorMessage(errorMessage);
                }

                await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
            }

            if (token.isCancellationRequested) {
                vscode.window.showInformationMessage(
                    "Documentation generation cancelled before final summary.",
                );
                return;
            }

            progress.report({
                message: "Aggregating results...",
                increment: 50,
            });

            const ig = createIgnoreInstance(projectRoot);
            const directoryStructure = generateDirectoryStructure(projectRoot, ig);

            const aggregatedDocuments = [];
            const aggregatedFlowChart = [];
            const techStackSet = new Set();
            for (const response of allApiResponses) {
                if (response.Document && Array.isArray(response.Document)) {
                    aggregatedDocuments.push(...response.Document);
                }

                if (response.techstack && Array.isArray(response.techstack)) {
                    response.techstack.forEach((tech) => techStackSet.add(tech));
                }
                if (response.FlowChart && Array.isArray(response.FlowChart)) {
                    aggregatedFlowChart.push(...response.FlowChart);
                }
                if (response.FlowChart) {
                    if (Array.isArray(response.FlowChart)) {
                        aggregatedFlowChart.push(...response.FlowChart);
                    } else if (typeof response.FlowChart === "string") {
                        aggregatedFlowChart.push(response.FlowChart); // <== Fix here
                    }
                }
            }

            const projectSummary = {
                directoryStructure: directoryStructure,
                Document: aggregatedDocuments,
                techstack: Array.from(techStackSet),
                FlowChart: aggregatedFlowChart,
            };

            const summaryFilePath = path.join(outputDir, `${projectName}.json`);
            fs.writeFileSync(summaryFilePath, JSON.stringify(projectSummary, null, 2), "utf8");

            vscode.window.showInformationMessage(
                `Docs generated! Individual files are in '${OUTPUT_FOLDER_NAME}' and the project summary is at ${summaryFilePath}`,
            );
        },
    );
}

/**
 * Creates and configures an 'ignore' instance based on .gitignore and default patterns.
 * @param {string} projectRoot The absolute path to the project's root directory.
 * @returns {import('ignore').Ignore}
 */
function createIgnoreInstance(projectRoot) {
    const ig = ignore();
    const gitignorePath = path.join(projectRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
        ig.add(fs.readFileSync(gitignorePath, "utf8"));
    }
    ig.add([".git", "node_modules", OUTPUT_FOLDER_NAME, ".vscode",".md", ".DS_Store"]);
    return ig;
}

/**
 * Recursively generates a JSON object representing the directory structure.
 * @param {string} dirPath The current directory path to process.
 * @param {import('ignore').Ignore} ig The ignore instance.
 * @param {string} projectRoot The root path of the project for relative calculations.
 * @returns {object} A nested object representing the file tree.
 */
function generateDirectoryStructure(dirPath, ig, projectRoot = dirPath) {
    const node = {
        name: path.basename(dirPath),
        type: "directory",
        children: [],
    };
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
        if (ig.ignores(relativePath)) {
            continue;
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            node.children.push(generateDirectoryStructure(filePath, ig, projectRoot));
        } else {
            node.children.push({ name: file, type: "file" });
        }
    }
    return node;
}

function getProjectFiles(projectRoot) {
    const ig = createIgnoreInstance(projectRoot);
    const fileObjects = [];
    function walk(currentDir) {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
            const filePath = path.join(currentDir, file);
            const relativePath = path.relative(projectRoot, filePath);
            const normalizedRelativePath = relativePath.replace(/\\/g, "/");
            if (ig.ignores(normalizedRelativePath) || FILES_TO_IGNORE.has(path.basename(file))) {
                continue;
            }
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                walk(filePath);
            } else if (stat.isFile() && ALLOWED_EXTENSIONS.has(path.extname(file))) {
                try {
                    const content = fs.readFileSync(filePath, "utf8");
                    if (content.trim() === "") {
                        console.warn(`Skipping empty file: ${filePath}`);
                        continue;
                    }
                    fileObjects.push({ relativePath, content });
                } catch (e) {
                    console.warn(`Could not read file ${filePath}: ${e.message}`);
                }
            }
        }
    }
    walk(projectRoot);
    return fileObjects;
}

function createDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

async function activeWindowToFileCommand() {
    vscode.window.showInformationMessage("This command is unchanged.");
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
