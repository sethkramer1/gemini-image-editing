import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HistoryItem, HistoryPart } from "@/lib/types";

// Initialize the Google Gen AI client with your API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Define the model ID for Gemini 2.0 Flash experimental 
// Use image generation specific model for editing
const MODEL_ID = "gemini-2.0-flash-exp-image-generation";
// Imagen 3 model ID
const IMAGEN_MODEL_ID = "imagen-3.0-generate-002";

// Define interface for the formatted history item
interface FormattedHistoryItem {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    inlineData?: { data: string; mimeType: string };
  }>;
}

export async function POST(req: NextRequest) {
  let model = "imagen-3"; // Default model
  
  try {
    // Parse JSON request instead of FormData
    const requestData = await req.json();
    model = requestData.model || "imagen-3"; // Store the model value for error handling
    const { prompt, image: inputImage, history, aspectRatio = "1:1" } = requestData;

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

    // Check if using Imagen 3 for initial generation
    if (model === "imagen-3" && !inputImage) {
      console.log("Using Imagen 3 API for initial image generation");
      console.log("Aspect ratio:", aspectRatio);
      
      // Validate aspect ratio
      const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
      console.log("Input aspect ratio:", aspectRatio);
      console.log("Valid aspect ratios:", validAspectRatios);
      const validatedAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "1:1";
      console.log("Validated aspect ratio:", validatedAspectRatio);
      
      if (validatedAspectRatio !== aspectRatio) {
        console.warn(`Invalid aspect ratio: ${aspectRatio}, defaulting to 1:1`);
      }
      
      try {
        // Create the request payload
        const requestPayload = {
          instances: [
            {
              prompt: prompt
            }
          ],
          parameters: {
            number_of_images: 1,
            aspectRatio: validatedAspectRatio
          }
        };
        
        // Log the full request for debugging
        console.log("Imagen API request payload (EXACT):", JSON.stringify(requestPayload, null, 2));
        console.log("Imagen API URL:", `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL_ID}:predict`);
        console.log("Imagen API Headers:", {
          "Content-Type": "application/json"
        });
        
        // Make a direct fetch request to the Imagen 3 API
        console.log(`Calling Imagen API with aspectRatio=${validatedAspectRatio}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL_ID}:predict?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestPayload),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Imagen API Error Response (raw):", errorText);
          
          let errorData;
          try {
            // Try to parse as JSON
            errorData = JSON.parse(errorText);
          } catch (e) {
            // If not valid JSON, use the text as the error message
            errorData = { 
              error: { 
                message: errorText.startsWith("An error") ? errorText : "Failed to parse error response" 
              } 
            };
          }
          
          console.error("Imagen API Error:", errorData);
          throw new Error(
            errorData.error?.message || `Imagen API error: ${response.status}`
          );
        }

        // Try to parse the JSON response with better error handling
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("Failed to parse Imagen API response as JSON:", jsonError);
          const rawText = await response.text().catch(() => "Unknown content");
          console.error("Raw response content:", rawText.substring(0, 200) + "..."); // Only log first 200 chars
          
          return NextResponse.json(
            { 
              error: "Invalid response from Imagen API",
              details: "The API returned a response that couldn't be processed",
              possibleCause: "This could be a temporary issue with the Imagen API. You might want to try again later or switch to the Gemini model which may be more reliable.",
              rawResponsePreview: rawText.substring(0, 100) + "..."
            }, 
            { status: 500 }
          );
        }

        console.log("Imagen API response structure:", JSON.stringify({
          hasResponse: !!data,
          hasPredictions: !!data.predictions,
          numPredictions: data.predictions?.length || 0,
          metadata: data.metadata || 'No metadata',
          fullResponseKeys: Object.keys(data)
        }, null, 2));

        if (!data.predictions || data.predictions.length === 0) {
          throw new Error("No image generated in Imagen API response");
        }

        // Extract the image data
        const imageData = data.predictions[0].bytesBase64Encoded;
        
        if (!imageData) {
          throw new Error("No image data in Imagen API response");
        }

        // Return the base64 image as JSON
        return NextResponse.json({
          image: `data:image/png;base64,${imageData}`,
          description: `Image generated with Google's Imagen 3 model using prompt: "${prompt}" (${validatedAspectRatio})`,
        });
      } catch (error) {
        console.error("Error in Imagen API:", error);
        
        // Determine if this is a JSON parsing error
        const errorMessage = error instanceof Error 
          ? error.message 
          : String(error);
          
        // Check if this might be a parsing error from the API response
        const isPossibleParsingError = errorMessage.includes("Unexpected token") || 
                                     errorMessage.includes("is not valid JSON");
        
        return NextResponse.json(
          { 
            error: "Failed to generate image with Imagen", 
            details: errorMessage,
            possibleCause: isPossibleParsingError 
              ? "The API returned a non-JSON response. This may be a temporary issue with the Imagen API." 
              : undefined
          }, 
          { status: 500 }
        );
      }
    }

    // For Gemini model or image editing
    // Get the model with the correct configuration for image generation
    const geminiModel = genAI.getGenerativeModel({
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
        geminiModel.generateContent(contentParts),
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
      
      // Check if we have a string error that might indicate a non-JSON response
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isPossibleParsingError = errorMessage.includes("Unexpected token") || 
                                   errorMessage.includes("is not valid JSON") ||
                                   errorMessage.includes("Request En");
      
      console.error("Full error details:", errorMessage);
      
      return NextResponse.json(
        { 
          error: "Failed to generate image", 
          details: errorMessage,
          possibleCause: isPossibleParsingError 
            ? "The API returned a non-JSON response. This may be a temporary issue with the Gemini API." 
            : undefined,
          fullError: error instanceof Error ? error.stack : undefined
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
    try {
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
    } catch (parseError) {
      console.error("Error parsing Gemini API response:", parseError);
      
      // Format the error for the client
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      const isPossibleParsingError = parseErrorMessage.includes("Unexpected token") || 
                                   parseErrorMessage.includes("is not valid JSON");
      
      return NextResponse.json(
        { 
          error: "Failed to process Gemini API response", 
          details: parseErrorMessage,
          possibleCause: isPossibleParsingError 
            ? "The API returned a response that couldn't be properly processed. This may be a temporary issue." 
            : undefined
        }, 
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
    
    // Check if we have a string error that might indicate a non-JSON response
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPossibleParsingError = errorMessage.includes("Unexpected token") || 
                                 errorMessage.includes("is not valid JSON") ||
                                 errorMessage.includes("Request En");
    
    return NextResponse.json(
      {
        error: "Failed to generate image",
        details: errorMessage,
        possibleCause: isPossibleParsingError 
          ? "The API returned a non-JSON response. This may be a temporary issue with the API." 
          : undefined,
        modelType: model === "imagen-3" ? "Imagen" : "Gemini"
      },
      { status: 500 }
    );
  }
}
