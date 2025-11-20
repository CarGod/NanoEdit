
import { GoogleGenAI, Modality } from "@google/genai";
import { ImageSession } from "../types";

// Helper to convert Data URL to Base64 string (stripping header)
const dataUrlToBase64 = (dataUrl: string): string => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL');
  }
  return matches[2];
};

export const generateEditedImages = async (
  sessions: ImageSession[],
  prompt: string,
  apiKey: string
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("请先配置您的 Google Gemini API 密钥。");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const parts: any[] = [];

  // 1. Add Images and Masks
  for (const session of sessions) {
    // Use the composite URL (Background + User Sketches)
    // If no composite exists (shouldn't happen if app logic is right), fallback to original
    const imageSource = session.compositeUrl || session.originalUrl;

    if (!imageSource) {
      continue; // Should not happen
    }

    const base64Image = dataUrlToBase64(imageSource);
    
    parts.push({
      inlineData: {
        mimeType: 'image/png', // Canvas exports are usually PNG
        data: base64Image
      }
    });

    // Mask Image (if drawn in mask mode)
    if (session.maskUrl) {
      const maskBase64 = dataUrlToBase64(session.maskUrl);
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: maskBase64
        }
      });
    }
  }

  // 2. Add the User Prompt
  let finalPrompt = prompt;
  const hasMasks = sessions.some(s => s.maskUrl);
  
  if (sessions.length === 0) {
    // Fallback for pure text prompt if no sessions exist (though App.tsx usually handles this by creating a dummy session)
    finalPrompt = prompt;
  } else if (hasMasks) {
    // Mask editing mode
    finalPrompt = `Edit the image(s) based on the user instruction. \n\nContext: The input includes an image followed by a black-and-white mask. White pixels in the mask indicate areas to edit.\n\nUser Instruction: ${prompt}`;
  } else {
    // General Generation / Image-to-Image mode
    // When generating from a blank canvas (text-to-image via reference) or an uploaded image,
    // we provide the image as a reference for aspect ratio and composition.
    // We avoid restrictive phrasing like "based on sketch" if it's just a blank canvas generation.
    finalPrompt = `${prompt}`;
  }

  parts.push({ text: finalPrompt });

  try {
    // Using Gemini 2.5 Flash Image
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const generatedImages: string[] = [];
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
          generatedImages.push(imageUrl);
        }
      }
    }

    return generatedImages;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "生成图片失败。");
  }
};