import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GENAI_API_KEY });

async function generateDocument(req, res) {
    const code = req.body.code;
    console.log("Received code for documentation generation");

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: `
    I have shared my code file below. Write the documentation

Instructions:-
- Create a JSON file
- Add or improve comments and documentation of code.
- Remove unused code
- Fix indentation and formatting
- Remove Duplicate code
- Create a dependency tree/graph within the \`FlowChart\` block
- Make a perfect flowchart and code in Mermaid code only
- Don't create unnecessary newlines
- In the \`Code\` block, include the full code with the code docstring
- Don't include // ✨ Auto-Generated Code Documentation
- The \`Document\` block should contain the function name and its full documentation
- Within the \`techstack\` block, list all the technologies used in the code

Follow the output format, it's an JSON file as:-
- Remove \`\`\`  or anything else which represents a code editor
- Remove \`\`\`python
- Graph is the 3rd independent element
- Generate Mermaid code without any syntax error, it's going to be integrated with mermaidchart.com
- Do not use any other code editor syntax like \`\`\`python or \`\`\`mermaid

Errors improvements:-
- While generating mermaid code the most common error is:-
Expecting 'SQE', 'DOUBLECIRCLEEND', 'PE', '-)', 'STADIUMEND', 'SUBROUTINEEND', 'PIPE', 'CYLINDEREND', 'DIAMOND_STOP', 'TAGEND', 'TRAPEND', 'INVTRAPEND', 'UNICODE_TEXT', 'TEXT', 'TAGSTART', got 'PS'
- Fix this error and generate the code without any syntax errors

Documentation format:-
    """
    Processes DDL statements to generate SQL scripts.
    It splits the DDL, generates data, and replaces markers for PDF, images, and passwords.

    Args:
        page: The page number to fetch.

    Returns:
        A list of image URLs.
    """

Codes used to make documentation and graph:-
${code}`,
        config: {
            thinkingConfig: {
                thinkingBudget: 0,
            },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    code: {
                        type: Type.STRING,
                        description: "Strictly include the full code with documentation",
                    },
                    Document: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                function: {
                                    type: Type.STRING,
                                    description: "Name of the function with the parameters",
                                },
                                DocString: {
                                    type: Type.STRING,
                                    description:
                                        "Will contain the whole logic and the documentation string of the function",
                                },
                            },
                        },
                    },
                    FlowChart: {
                        type: Type.STRING,
                        description: "Mermaid code of the flowchart without any syntax errors.",
                    },
                    techstack: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                            description: "List of technologies used in the code",
                        },
                    },
                },
            },
        },
    });

    if (response.error) {
        return res.status(500).json({ error: response.error.message });
    }
    if (!response.text || response.text.trim() === "") {
        return res.status(500).json({ error: "No content generated" });
    }

    return res.status(200).json(JSON.parse(response.text));
}

export { generateDocument };
