import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getSmartExcelMapping(headers: string[], targetKeys: string[]): Promise<Record<string, string>> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("Gemini API key missing, falling back to basic mapping.");
    return {};
  }

  const prompt = `
    You are an expert production data analyst. I have an Excel file with the following headers:
    [${headers.join(", ")}]

    I need to map these headers to the following internal database fields:
    [${targetKeys.join(", ")}]

    Context:
    - 'date': The entry date.
    - 'poNo': Purchase Order Number or Job ID.
    - 'color': Garment color.
    - 'cut': Cutting quantity.
    - 'sewOut': Sewing output.
    - 'washR': Wash receive/output.
    - 'finIn': Finishing input.
    - 'finOut': Finishing output.
    - 'poly': Poly/Packing quantity.
    - 'shipment': Shipment quantity.
    - 'floor': Production floor or line.
    - 'buyer': Buyer name.
    - 'style': Style name/ID.
    - 'orderQty': Total order quantity.

    Return ONLY a JSON object where keys are the internal fields and values are the exact matching Excel headers.
    If no reasonably confident match exists for a field, omit it.
    Example: {"poNo": "PO Number", "poly": "Packing Qty"}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    
    // @google/genai uses .text directly, not .text()
    const text = response.text || '';
    
    // Extract JSON if model wraps it in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error("Gemini mapping failed:", error);
    return {};
  }
}
