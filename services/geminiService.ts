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

// Helper to create a blank white image of specific aspect ratio
// This forces gemini-2.5-flash-image to output in this ratio
const createBlankBase64Image = (aspectRatio: string): string => {
    const [wRatio, hRatio] = aspectRatio.split(':').map(Number);
    const canvas = document.createElement('canvas');
    
    // Set a base size that is large enough for good quality but not huge
    const baseSize = 1024;
    
    if (wRatio > hRatio) {
        canvas.width = baseSize;
        canvas.height = Math.round(baseSize * (hRatio / wRatio));
    } else {
        canvas.width = Math.round(baseSize * (wRatio / hRatio));
        canvas.height = baseSize;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Return base64 string without header
    return canvas.toDataURL('image/png').split(',')[1];
};

export const generateEditedImages = async (
  sessions: ImageSession[],
  prompt: string,
  apiKey: string,
  aspectRatio: string = '1:1'
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("请先配置您的 Google Gemini API 密钥。");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const parts: any[] = [];

  try {
    // --- STRICT GEMINI 2.5 FLASH IMAGE LOGIC ---
    // We do not use Imagen 3. Everything goes through Flash Image.
    
    // 1. Prepare Image Parts
    // If sessions exist, we use them. 
    // If sessions are empty (or blank canvas with no data yet), we generate a blank placeholder.
    
    const activeSessions = sessions.length > 0 ? sessions : [{ 
        id: 'temp', 
        file: null, 
        originalUrl: null, 
        maskUrl: null, 
        compositeUrl: null, 
        isDirty: false, 
        hasDrawings: false 
    }];

    let hasRealInputImage = false;
    let hasMasks = false;

    for (const session of activeSessions) {
        // Determine the base image source
        let base64Image = '';

        if (session.compositeUrl) {
            // User has drawn something or uploaded something
            base64Image = dataUrlToBase64(session.compositeUrl);
            hasRealInputImage = true;
        } else if (session.originalUrl) {
            // User uploaded an image but didn't draw
            base64Image = dataUrlToBase64(session.originalUrl);
            hasRealInputImage = true;
        } else {
            // User wants a "Text to Image" generation (Blank Canvas).
            // We must synthesize a blank image of the correct Aspect Ratio 
            // to force the model to respect the dimensions.
            base64Image = createBlankBase64Image(aspectRatio);
            hasRealInputImage = false; // It's an artificial input
        }

        parts.push({
            inlineData: {
                mimeType: 'image/png',
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
            hasMasks = true;
        }
    }

    // 2. Prepare Prompt
    let finalPrompt = prompt;
    
    if (hasMasks) {
        // Explicit Inpainting Mode
        finalPrompt = `Edit the image based on this instruction: ${prompt}. \n\nThe input includes an image followed by a mask. Only edit the areas covered by the mask (white pixels). Keep the rest of the image exactly the same.`;
    } else if (!hasRealInputImage) {
        // Simulated Text-to-Image (Blank Canvas)
        // We instruct the model to fill the canvas
        finalPrompt = `Generate a high-quality image of: ${prompt}. \n\nUse the provided white image as the canvas size and aspect ratio reference. Fill the entire canvas.`;
    } else {
        // General Image Editing / Sketch-to-Image without mask
        finalPrompt = `${prompt}`;
    }

    parts.push({ text: finalPrompt });

    // 3. Call API
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: parts,
        },
        config: {
            responseModalities: [Modality.IMAGE],
            // We rely on the input image dimensions (real or synthetic) to control aspect ratio
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
    
    const errorMessage = (error?.message || JSON.stringify(error)).toLowerCase();
    if (
        errorMessage.includes('429') || 
        errorMessage.includes('resource_exhausted') || 
        errorMessage.includes('quota')
    ) {
        throw new Error("API 配额耗尽 (429)。请稍后重试或检查您的配额。");
    }

    throw new Error(error?.message || "生成图片失败，请检查 API Key 或网络连接。");
  }
};