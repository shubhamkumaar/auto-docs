const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const ignore = require("ignore");
const axios = require("axios"); // Import axios
const SidebarProvider = require("./sidebarProvider");

// --- CONFIGURATION ---
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
const OUTPUT_FOLDER_NAME = "llm-output";
// --- END CONFIGURATION ---

function activate(context) {
  console.log(
    'Congratulations, your extension "llm-project-tools" is now active!'
  );

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "llm-tools-sidebar",
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "llm-project-tools.projectToFile",
      projectToFileCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "llm-project-tools.activeWindowToFile",
      activeWindowToFileCommand
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "llm-project-tools.generateReadme",
      generateReadmeCommand // This is now an async function
    )
  );
}

// Command Implementations
async function projectToFileCommand() {
  // ... (This function remains unchanged)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "No project folder is open. Please open a project to use this feature."
    );
    return;
  }
  const projectRoot = workspaceFolders[0].uri.fsPath;
  const outputDir = path.join(projectRoot, OUTPUT_FOLDER_NAME);
  createDirectory(outputDir);

  try {
    const fullText = processProject(projectRoot);
    const outputFile = path.join(outputDir, "project_context.txt");
    fs.writeFileSync(outputFile, fullText, "utf8");
    vscode.window.showInformationMessage(
      `Project successfully converted to text at ${outputFile}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to process project: ${error.message}`
    );
  }
}

async function activeWindowToFileCommand() {
  // ... (This function remains unchanged)
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found.");
    return;
  }
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage(
      "Please open a project folder to save the file."
    );
    return;
  }
  const projectRoot = workspaceFolders[0].uri.fsPath;
  const outputDir = path.join(projectRoot, OUTPUT_FOLDER_NAME);
  createDirectory(outputDir);
  const fileName = path.basename(editor.document.fileName);
  const outputFile = path.join(outputDir, `${fileName}.txt`);
  const content = editor.document.getText();
  fs.writeFileSync(outputFile, content, "utf8");
  vscode.window.showInformationMessage(
    `Active window content saved to ${outputFile}`
  );
}

// --- MODIFIED COMMAND ---
// async function generateReadmeCommand() {
//   const workspaceFolders = vscode.workspace.workspaceFolders;
//   if (!workspaceFolders) {
//     vscode.window.showErrorMessage(
//       "Please open a project folder to generate a README."
//     );
//     return;
//   }
//   const projectRoot = workspaceFolders[0].uri.fsPath;

//   // 1. Get API Key from settings
//   const apiKey = vscode.workspace
//     .getConfiguration("llm-project-tools")
//     .get("geminiApiKey");
//   if (!apiKey) {
//     vscode.window.showErrorMessage(
//       "Gemini API key not found. Please set it in the extension settings."
//     );
//     return;
//   }

//   // Use a progress indicator
//   await vscode.window.withProgress(
//     {
//       location: vscode.ProgressLocation.Notification,
//       title: "🤖 Generating README with Gemini...",
//       cancellable: false,
//     },
//     async (progress) => {
//       try {
//         progress.report({ message: "Reading project files..." });
//         const projectContext = processProject(projectRoot);

//         if (!projectContext.trim()) {
//           vscode.window.showWarningMessage(
//             "No relevant files found to generate a README. Check your configuration."
//           );
//           return;
//         }

//         progress.report({ message: "Calling Gemini API..." });
//         const readmeContent = await callGeminiApi(projectContext, apiKey);

//         progress.report({ message: "Saving README.md..." });
//         const outputDir = path.join(projectRoot, OUTPUT_FOLDER_NAME);
//         createDirectory(outputDir);
//         const outputFile = path.join(outputDir, "README.md");
//         fs.writeFileSync(outputFile, readmeContent, "utf8");

//         vscode.window.showInformationMessage(
//           `Successfully generated README.md at ${outputFile}`
//         );

//         const fileUri = vscode.Uri.file(outputFile);
//         vscode.window.showTextDocument(fileUri);
//       } catch (error) {
//         console.error("Error generating README:", error);
//         vscode.window.showErrorMessage(
//           `Failed to generate README: ${error.message}`
//         );
//       }
//     }
//   );
// }

async function generateReadmeCommand() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage(
      "Please open a project folder to generate a README."
    );
    return;
  }
  const projectRoot = workspaceFolders[0].uri.fsPath;

  // 1. Get API Key from settings
  // const config = vscode.workspace.getConfiguration("llm-project-tools");
  // const apiKey = config.get("geminiApiKey");
  const apiKey = "AIzaSyDypjJeyZtJfnt6H8vPqNN-F5IoWA03Ihs";

  // --- START OF IMPROVED ERROR HANDLING ---
  if (!apiKey) {
    const openSettingsButton = "Open Settings";

    // Show an error message with a button
    const result = await vscode.window.showErrorMessage(
      "Gemini API key not found. Please set it in the extension settings.",
      openSettingsButton
    );

    // If the user clicks the button, open the settings UI
    if (result === openSettingsButton) {
      // This command opens the settings and searches for your specific setting
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "llm-project-tools.geminiApiKey"
      );
    }

    // Stop the command execution
    return;
  }
  // --- END OF IMPROVED ERROR HANDLING ---

  // Use a progress indicator
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🤖 Generating README with Gemini...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Reading project files..." });
        const projectContext = processProject(projectRoot);

        if (!projectContext.trim()) {
          vscode.window.showWarningMessage(
            "No relevant files found to generate a README. Check your configuration."
          );
          return;
        }

        progress.report({ message: "Calling Gemini API..." });
        const readmeContent = await callGeminiApi(projectContext, apiKey);

        progress.report({ message: "Saving README.md..." });
        const outputDir = path.join(projectRoot, OUTPUT_FOLDER_NAME);
        createDirectory(outputDir);
        const outputFile = path.join(outputDir, "README.md");
        fs.writeFileSync(outputFile, readmeContent, "utf8");

        vscode.window.showInformationMessage(
          `Successfully generated README.md at ${outputFile}`
        );

        const fileUri = vscode.Uri.file(outputFile);
        vscode.window.showTextDocument(fileUri);
      } catch (error) {
        console.error("Error generating README:", error);
        vscode.window.showErrorMessage(
          `Failed to generate README: ${error.message}`
        );
      }
    }
  );
}

// --- NEW HELPER FUNCTION ---
/**
 * Calls the Gemini API to generate content.
 * @param {string} projectContext The combined text of all project files.
 * @param {string} apiKey The user's Gemini API key.
 * @returns {Promise<string>} The generated README content.
 */
async function callGeminiApi(projectContext, apiKey) {
  // We'll use the gemini-1.5-flash-latest model
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `
    Based on the following project context, please generate a comprehensive and well-structured README.md file.

    The README should include:
    1.  A concise project title and a one-sentence summary.
    2.  A "Features" section listing key capabilities.
    3.  A "Getting Started" section with prerequisites and installation steps (e.g., \`npm install\`).
    4.  A "Usage" section explaining how to run the project (e.g., \`npm start\`).
    5.  A brief overview of the project structure, highlighting important files and folders.

    Do not include any text before the opening \`#\` of the title or after the final sentence. The output must be pure Markdown.

    --- PROJECT CONTEXT ---
    ${projectContext}
  `;

  try {
    const response = await axios.post(
      apiEndpoint,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    // Extract the text from the response
    return response.data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    if (error.response) {
      console.error("API Error Response:", error.response.data);
      const errorMessage =
        error.response.data?.error?.message || "An unknown API error occurred.";
      throw new Error(`Gemini API Error: ${errorMessage}`);
    } else {
      throw new Error(`Network or request setup error: ${error.message}`);
    }
  }
}

// Helper Functions
function processProject(projectRoot) {
  const ig = ignore();
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }
  ig.add([".git", "node_modules", OUTPUT_FOLDER_NAME, ".vscode"]);

  let fullText = "";

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const relativePath = path.relative(projectRoot, filePath);
      // Normalize for ignore matching
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
          fullText += `--- File: ${normalizedRelativePath} ---\n\n${content}\n\n`;
        } catch (e) {
          console.warn(`Could not read file ${filePath}: ${e.message}`);
        }
      }
    }
  }
  walk(projectRoot);
  return fullText;
}

function createDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
