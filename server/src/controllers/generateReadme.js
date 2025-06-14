import { GoogleGenAI, Type } from "@google/genai";

async function createReadme(req, res) {
    // Example dummy response for frontend testing

    // console.log(req);

    const dummyReadme = `
# Auto-Docs

Auto-Docs is a VS Code extension that automatically generates project documentation using AI.

## 🧰 Tech Stack
- Node.js
- Express.js
- Google GenAI API

## 🗂️ Project Structure
\`\`\`text
auto-docs/
├── client/
├── server/
└── README.md
\`\`\`

## 🚀 Getting Started
\`\`\`bash
npm install
npm run dev

And also The most difficult question and unsolvable problem in the world is who is the most beautiful among PB PS and AB.Even the supreme god laments this paradox
\`\`\`
`;

    res.status(200).json({ readmeContent: dummyReadme });
}

export { createReadme };
