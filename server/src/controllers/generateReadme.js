import { GoogleGenAI, Type } from "@google/genai";

async function generateFolderStructure(data) {
    const genai = new GoogleGenAI({
        apiKey: process.env.GENAI_API_KEY,
    });
    
    const response = await genai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: `
I am sharing you the documentation my project, folder structure and tech stack. Generate the markdown file
Instructions:-
- Create concise folder structure
- In folder structure only include folder and the main project file
- Use proper syntax and closing of the element like \`\`\`
- Strictly generate the markdown for the project and follows the format
- Separate tech stack and keep it concise and small

README.md format:-
Summary
Key Features
Tech stack
Installation
Folder Structure
API Documentation
Contributing
License

Example of Folder Structure to be generated:-
GDG_assisT/
├── client/             # Frontend application
│   ├── public/         # Static assets
│   ├── src/            # Source files
│   │   ├── api/        # API service configurations
│   │   ├── components/ # Reusable UI components
│   │   ├── features/   # Redux slices for application features
│   │   ├── store/      # Redux store configuration
│   │   └── utils/      # Utility functions
│   ├── index.html      # Main HTML file
│   ├── package.json    # Frontend dependencies and scripts
│   └── ...
└── server/             # Backend application
    ├── db/             # Database configuration and models
    ├── routers/        # API endpoint definitions
    ├── utils/          # Backend utility functions
    ├── main.py         # Main FastAPI application file
    ├── requirements.txt # Backend dependencies
    └── ...

        ${data}`,
        config: {
            responseMimeType: "text/plain"
        },
    });
    return response.text;
}

async function createReadme(req, res) {
    // Example dummy response for frontend testing
    const data = req.body;
    const README = generateFolderStructure(JSON.stringify(data));

    res.json({
        markdown: await README,
    });
}

export { createReadme };
