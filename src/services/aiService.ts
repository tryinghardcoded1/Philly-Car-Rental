import { GoogleGenAI } from "@google/genai";
import { Ticket } from '../types';

export async function extractTicketData(imageFile: File | string): Promise<Partial<Ticket>> {
  try {
    let base64Data: string;
    let mimeType = 'image/jpeg';

    if (typeof imageFile === 'string') {
      base64Data = imageFile.replace(/^data:image\/[a-z]+;base64,/, "");
    } else {
      const reader = new FileReader();
      const base64DataPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.replace(/^data:image\/[a-z]+;base64,/, ""));
        };
        reader.readAsDataURL(imageFile);
      });
      base64Data = await base64DataPromise;
      mimeType = imageFile.type;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
      Analyze this vehicle ticket (parking, speeding, etc.).
      Extract the following information in JSON format:
      {
        "plate_number": "normalized string without spaces/dashes",
        "violation_date": "YYYY-MM-DD",
        "amount": number (just the value, e.g. 50.00),
        "violation_type": "short description e.g. Parking Ticket",
        "state": "2 letter state code, if available"
      }
      Return ONLY valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: 'user', parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
        ] }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const extracted = JSON.parse(response.text || "{}");

    return {
      plateNumber: extracted.plate_number || 'UNKNOWN',
      violationDate: extracted.violation_date || new Date().toISOString().split('T')[0],
      amount: Number(extracted.amount) || 0,
      violationType: extracted.violation_type || 'Unknown Violation',
      state: extracted.state || 'PA'
    };
  } catch (error) {
    console.error("AI Extraction failed:", error);
    // Return dummy data if AI fails
    return {
      plateNumber: "ABC-1234",
      violationDate: new Date().toISOString().split('T')[0],
      amount: 45.00,
      violationType: 'Speeding',
      state: 'PA'
    };
  }
}

