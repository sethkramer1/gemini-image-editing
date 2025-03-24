import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HistoryItem, HistoryPart } from "@/lib/types";

// Initialize the Google Gen AI client with your API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Define the model ID for Gemini 2.0 Flash experimental 
// Use image generation specific model for editing
const MODEL_ID = "gemini-2.0-flash-exp-image-generation";

// Define interface for the formatted history item
interface FormattedHistoryItem {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    inlineData?: { data: string; mimeType: string };
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // Parse JSON request instead of FormData
    const requestData = await req.json();
    const { prompt, image: inputImage, history } = requestData;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    // Get the model with the correct configuration for image generation
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        // @ts-expect-error - Gemini API JS is missing this type
        responseModalities: ["Text", "Image"],
      },
    });

    let result;

    try {
      // Prepare the content parts for direct generation
      const contentParts = [];

      // Add the text prompt first
      contentParts.push({ 
        text: prompt  // Use the same prompt structure for both generation and editing
      });

      // Process the image if provided (for editing)
      if (inputImage) {
        // For image editing
        console.log("Processing image edit request with prompt:", prompt);

        // Check if the image is a valid data URL - more robust check
        if (!inputImage || typeof inputImage !== 'string') {
          console.error("Invalid image input:", inputImage ? typeof inputImage : 'null');
          return NextResponse.json(
            { error: "Invalid image input" },
            { status: 400 }
          );
        }

        // More permissive check for data URLs
        if (!inputImage.includes('data:') || !inputImage.includes(';base64,')) {
          console.error("Invalid image data URL format - not a base64 data URL");
          return NextResponse.json(
            { error: "Invalid image data URL format" },
            { status: 400 }
          );
        }

        // Extract the base64 part after the comma
        const base64Index = inputImage.indexOf(';base64,');
        if (base64Index === -1) {
          console.error("Invalid image data URL format - missing base64 marker");
          return NextResponse.json(
            { error: "Invalid image data URL format" },
            { status: 400 }
          );
        }

        const base64Image = inputImage.substring(base64Index + 8);
        
        // Determine MIME type from the data URL
        const mimeMatch = inputImage.match(/data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        
        console.log(
          "Image data prepared for editing: length:",
          base64Image.length,
          "MIME type:",
          mimeType
        );

        // Add the image to content parts
        contentParts.push({
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        });
      } else {
        console.log("No image provided, text-only prompt for generation:", prompt);
      }

      // Log what we're sending
      console.log("Sending content with", contentParts.length, "parts");
      console.log("Content parts structure:", JSON.stringify({
        hasParts: contentParts.length > 0,
        hasPrompt: contentParts.some(part => part.text),
        hasImage: contentParts.some(part => part.inlineData),
        promptText: contentParts.find(part => part.text)?.text?.substring(0, 50) + "...",
        imageDataLength: contentParts.find(part => part.inlineData)?.inlineData?.data?.length || 0
      }, null, 2));
      
      // Create a promise that rejects after a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timed out')), 25000); // 25 second timeout
      });
      
      // Use direct generateContent instead of chat
      result = await Promise.race([
        model.generateContent(contentParts),
        timeoutPromise
      ]) as any;

      // Log the raw result for debugging
      console.log("Raw API result structure:", JSON.stringify({
        hasResponse: !!result?.response,
        candidates: result?.response?.candidates?.length || 0,
        candidateTypes: result?.response?.candidates?.map(c => ({
          hasContent: !!c.content,
          partTypes: c.content?.parts?.map(p => Object.keys(p))
        }))
      }, null, 2));

    } catch (error) {
      console.error("Error in generateContent:", error);
      console.error("Full error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { 
          error: "Failed to generate image", 
          details: error instanceof Error ? error.message : String(error),
          fullError: JSON.stringify(error, null, 2)
        }, 
        { status: 500 }
      );
    }

    if (!result?.response) {
      console.error("No response object in result:", result);
      return NextResponse.json(
        { error: "Invalid API response structure" },
        { status: 500 }
      );
    }

    const response = result.response;

    let textResponse = null;
    let imageData = null;
    let mimeType = "image/png";

    // Process the response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      console.log("Number of parts in response:", parts.length);

      for (const part of parts) {
        if ("inlineData" in part && part.inlineData) {
          // Get the image data
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          console.log(
            "Image data received, length:",
            imageData.length,
            "MIME type:",
            mimeType
          );
        } else if ("text" in part && part.text) {
          // Store the text
          textResponse = part.text;
          console.log(
            "Text response received:",
            textResponse.substring(0, 50) + "..."
          );
        }
      }
    } else {
      console.error("No candidates in response or empty response", response);
      return NextResponse.json(
        { error: "No valid response from Gemini API" },
        { status: 500 }
      );
    }

    if (!imageData) {
      console.warn("No image data in response");
      return NextResponse.json(
        { error: "No image generated in response" },
        { status: 500 }
      );
    }

    // Return just the base64 image and description as JSON
    return NextResponse.json({
      image: imageData ? `data:${mimeType};base64,${imageData}` : null,
      description: textResponse,
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
