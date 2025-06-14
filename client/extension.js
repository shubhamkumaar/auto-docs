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
  ".json",
  ".md",
  ".py",
  ".html",
  ".css",
]);
const FILES_TO_IGNORE = new Set(["package-lock.json"]);
const OUTPUT_FOLDER_NAME = "auto-docs-llm-output";
const API_DELAY_MS = 250;

function activate(context) {
  console.log("Congratulations, your extension is now active!");

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "auto-docs-sidebar",
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "auto-docs-tools.projectToFile",
      projectToFileCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "auto-docs-tools.activeWindowToFile",
      activeWindowToFileCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "auto-docs-tools.generateReadme",
      generateReadmeCommand
    )
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
        vscode.window.showWarningMessage(
          "No processable files found in the project."
        );
        return;
      }

      progress.report({
        message: "Processing individual files...",
        increment: 0,
      });
      for (let i = 0; i < totalFiles; i++) {
        if (token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            "Documentation generation cancelled."
          );
          return;
        }

        const file = filesToProcess[i];
        const increment = 100 / totalFiles / 2;
        progress.report({
          message: `(${i + 1}/${totalFiles}) ${file.relativePath}`,
          increment: increment,
        });

        try {
          const response = await axios.post("http://localhost:3000/api/doc/", {
            code: file.content,
          });
          if (response.data) {
            const safeFileName = file.relativePath.replace(/[\\/]/g, "_");
            const outputFile = path.join(outputDir, `${safeFileName}.json`);
            fs.writeFileSync(
              outputFile,
              JSON.stringify(response.data, null, 2),
              "utf8"
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
          "Documentation generation cancelled before final summary."
        );
        return;
      }

      progress.report({ message: "Aggregating results...", increment: 50 });

      const ig = createIgnoreInstance(projectRoot);
      const directoryStructure = generateDirectoryStructure(projectRoot, ig);

      const aggregatedDocuments = [];
      const techStackSet = new Set();

      for (const response of allApiResponses) {
        if (response.Document && Array.isArray(response.Document)) {
          aggregatedDocuments.push(...response.Document);
        }

        if (response.techstack && Array.isArray(response.techstack)) {
          response.techstack.forEach((tech) => techStackSet.add(tech));
        }
      }

      const projectSummary = {
        directoryStructure: directoryStructure,
        Document: aggregatedDocuments,
        techstack: Array.from(techStackSet),
      };

      const summaryFilePath = path.join(outputDir, `${projectName}.json`);
      fs.writeFileSync(
        summaryFilePath,
        JSON.stringify(projectSummary, null, 2),
        "utf8"
      );

      vscode.window.showInformationMessage(
        `Docs generated! Individual files are in '${OUTPUT_FOLDER_NAME}' and the project summary is at ${summaryFilePath}`
      );
    }
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
  ig.add([".git", "node_modules", OUTPUT_FOLDER_NAME, ".vscode", "llm-output"]);
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
    const relativePath = path
      .relative(projectRoot, filePath)
      .replace(/\\/g, "/");
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
      if (
        ig.ignores(normalizedRelativePath) ||
        FILES_TO_IGNORE.has(path.basename(file))
      ) {
        continue;
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (stat.isFile() && ALLOWED_EXTENSIONS.has(path.extname(file))) {
        try {
          const content = fs.readFileSync(filePath, "utf8");
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
async function generateReadmeCommand() {
  vscode.window.showErrorMessage(
    "`generateReadmeCommand` needs to be updated to use your backend API."
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
