import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GENAI_API_KEY });

async function graphMerge(req, res) {
  const flowcharts = req.body.flowcharts;
  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        flowchart: {
          type: Type.STRING,
        },
      },
    },
  };
  const model = "gemini-2.5-flash-preview-04-17";
  const contents = `
${flowcharts}  
Above given flowcharts are the individual page chart merge it to make the flowchart of the project
Instructions:-
- Write Mermaid code without any syntax error
- Strictly follow the mermaidcharts code rules
- Don't add any comments

Common Errors:-
1. Error: Error: Parse error on line 52:
...n];    AF --> Q; % Return to the main g
----------------------^
Expecting 'SEMI', 'NEWLINE', 'EOF', 'AMP', 'START_LINK', 'LINK', 'LINK_ID', got 'NODE_STRING'
2. Error: Error: Parse error on line 10:
...No --> G3[Split DDL (using split_ddl log
-----------------------^
Expecting 'SQE', 'DOUBLECIRCLEEND', 'PE', '-)', 'STADIUMEND', 'SUBROUTINEEND', 'PIPE', 'CYLINDEREND', 'DIAMOND_STOP', 'TAGEND', 'TRAPEND', 'INVTRAPEND', 'UNICODE_TEXT', 'TEXT', 'TAGSTART', got 'PS'', 

- Don't make above code errors strictly follow the code rules`;
  
const response = await ai.models.generateContent({
    model,
    contents,
    config,
  });

  if (response.error) {
    return res.status(500).json({ error: response.error.message });
  }

  const flowchart = JSON.parse(response.text).flowchart;
  return res.status(200).json({ flowchart });
}
export { graphMerge };
