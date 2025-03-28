import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { HistoryItem, HistoryPart } from "@/lib/types";
import { env } from "process";

// Import the server-side image processing helper (for Node.js environment)
import sharp from "sharp";

// Initialize the Google Gen AI client with your API key
// Try both environment variable names (the original and an alternative)
const GEMINI_API_KEY = env.GEMINI_API_KEY || env.NEXT_GEMINI_API_KEY || "";
// Debug log for environment variables
console.log("Environment variable check on initialization:", {
  hasGeminiKey: !!GEMINI_API_KEY,
  keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
  keyFirstChars: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 5) + '...' : 'none',
  allEnvKeys: Object.keys(env).filter(key => key.includes('GEMINI') || key.includes('API')),
  envVarSources: {
    GEMINI_API_KEY: !!env.GEMINI_API_KEY,
    NEXT_GEMINI_API_KEY: !!env.NEXT_GEMINI_API_KEY
  }
});
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

// Server-side image optimization function
async function optimizeImageServer(imageDataUrl: string, maxWidth = 1024, quality = 80): Promise<string> {
  try {
    // Extract base64 data and MIME type
    const matches = imageDataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid data URL format");
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Process the image with Sharp
    let processedBuffer;
    const sharpImage = sharp(buffer);
    const metadata = await sharpImage.metadata();
    
    // Only resize if image is larger than maxWidth
    if (metadata.width && metadata.width > maxWidth) {
      sharpImage.resize(maxWidth);
    }
    
    // Choose output format based on input format
    if (mimeType.includes('png')) {
      processedBuffer = await sharpImage
        .png({ quality, compressionLevel: 9 })
        .toBuffer();
    } else {
      // Default to JPEG for better compression
      processedBuffer = await sharpImage
        .jpeg({ quality })
        .toBuffer();
    }
    
    // Convert back to data URL
    const outputMimeType = mimeType.includes('png') ? 'image/png' : 'image/jpeg';
    const optimizedDataUrl = `data:${outputMimeType};base64,${processedBuffer.toString('base64')}`;
    
    // Log size reduction
    console.log(
      "Image optimization:",
      "original:", (buffer.length / 1024).toFixed(2), "KB,",
      "optimized:", (processedBuffer.length / 1024).toFixed(2), "KB,",
      "reduction:", Math.round((1 - processedBuffer.length / buffer.length) * 100) + "%"
    );
    
    return optimizedDataUrl;
  } catch (error) {
    console.error("Image optimization error:", error);
    // Return original if optimization fails
    return imageDataUrl;
  }
}

export async function POST(req: NextRequest) {
  let model = "imagen-3"; // Default model
  const isProduction = process.env.NODE_ENV === 'production';
  let useGeminiFallback = false; // Flag to indicate if we should fallback to Gemini
  
  // Additional debug logging for environment variables
  console.log("Environment check in POST handler:", {
    hasGeminiKey: !!GEMINI_API_KEY,
    keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    allEnvKeys: Object.keys(env).filter(key => key.includes('GEMINI') || key.includes('API')),
    nodeEnv: process.env.NODE_ENV,
    isProduction
  });
  
  try {
    // Parse JSON request instead of FormData
    const requestData = await req.json();
    model = requestData.model || "imagen-3"; // Store the model value for error handling
    const { prompt, image: inputImage, history, aspectRatio = "1:1", isEditing = false } = requestData;

    // Log the request details
    console.log("Request details:", {
      hasPrompt: !!prompt,
      hasImage: !!inputImage,
      imageLength: inputImage ? (typeof inputImage === 'string' ? inputImage.length : 'not a string') : 0,
      historyLength: history?.length || 0,
      model,
      isEditingMode: isEditing,
      aspectRatio
    });

    // If in editing mode, log that we're only using the last image
    if (isEditing && inputImage) {
      console.log("Image editing mode detected - using only the current image and prompt, ignoring conversation history");
    }

    // Force model to "gemini" for image editing
    if (isEditing && inputImage) {
      console.log("Image editing detected, forcing model to Gemini");
      model = "gemini";
    }

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

    // Check if using Imagen 3 for initial generation and we don't need to fallback yet
    if (model === "imagen-3" && !inputImage && !useGeminiFallback && !isEditing) {
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
        
        // Create a fetch function with retry capability
        const fetchWithRetry = async (url: string, options: RequestInit, retries = 2, delay = 1000) => {
          try {
            return await fetch(url, options);
          } catch (err) {
            console.error(`Fetch attempt failed: ${err}`);
            if (retries <= 0) throw err;
            console.log(`Retrying in ${delay}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries - 1, delay * 2);
          }
        };

        // Enhanced options for better compatibility with Vercel
        const fetchOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add additional headers to help with Vercel infrastructure
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "VercelServerlessFunction"
          },
          body: JSON.stringify(requestPayload),
          // Add a longer timeout for Vercel
          signal: AbortSignal.timeout(50000), // 50 second timeout
        };

        // Log the full request for debugging
        console.log("Enhanced fetch options:", JSON.stringify({
          method: fetchOptions.method,
          headers: fetchOptions.headers,
          hasBody: !!fetchOptions.body,
        }, null, 2));

        // Make a direct fetch request to the Imagen 3 API
        console.log(`Calling Imagen API with aspectRatio=${validatedAspectRatio}`);
        const response = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL_ID}:predict?key=${GEMINI_API_KEY}`,
          fetchOptions
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
          
          // If in production and we get an error, try falling back to Gemini model
          if (isProduction) {
            console.log("Production environment detected. Falling back to Gemini model after Imagen failed");
            // Set the fallback flag and change model
            useGeminiFallback = true;
            model = "gemini";
          } else {
            throw new Error(
              errorData.error?.message || `Imagen API error: ${response.status}`
            );
          }
        }

        // Only continue with Imagen if we're not falling back to Gemini
        if (!useGeminiFallback) {
          // Try to parse the JSON response with better error handling
          let data;
          try {
            data = await response.json();
          } catch (jsonError) {
            console.error("Failed to parse Imagen API response as JSON:", jsonError);
            const rawText = await response.text().catch(() => "Unknown content");
            console.error("Raw response content:", rawText.substring(0, 200) + "..."); // Only log first 200 chars
            
            // In production, fallback to Gemini instead of returning error
            if (isProduction) {
              console.log("Production environment detected. Falling back to Gemini model after Imagen JSON parse error");
              useGeminiFallback = true;
              model = "gemini";
            } else {
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
          }

          // Only continue processing Imagen response if we have data and aren't using fallback
          if (data && !useGeminiFallback) {
            console.log("Imagen API response structure:", JSON.stringify({
              hasResponse: !!data,
              hasPredictions: !!data.predictions,
              numPredictions: data.predictions?.length || 0,
              metadata: data.metadata || 'No metadata',
              fullResponseKeys: Object.keys(data)
            }, null, 2));

            if (!data.predictions || data.predictions.length === 0) {
              if (isProduction) {
                console.log("Production environment detected. No predictions in Imagen response. Falling back to Gemini model");
                useGeminiFallback = true;
                model = "gemini";
              } else {
                throw new Error("No image generated in Imagen API response");
              }
            }

            // Only try to extract image if we're not using fallback
            if (!useGeminiFallback) {
              // Extract the image data
              const imageData = data.predictions[0].bytesBase64Encoded;
              
              if (!imageData) {
                if (isProduction) {
                  console.log("Production environment detected. No image data in Imagen response. Falling back to Gemini model");
                  useGeminiFallback = true;
                  model = "gemini";
                } else {
                  throw new Error("No image data in Imagen API response");
                }
              }

              // Only return result if we have image data and aren't using fallback
              if (imageData && !useGeminiFallback) {
                // Return the base64 image as JSON
                return NextResponse.json({
                  image: `data:image/png;base64,${imageData}`,
                  description: `Image generated with Google's Imagen 3 model using prompt: "${prompt}" (${validatedAspectRatio})`,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error in Imagen API:", error);
        
        // Determine if this is a JSON parsing error
        const errorMessage = error instanceof Error 
          ? error.message 
          : String(error);
          
        // Check if this might be a parsing error from the API response
        const isPossibleParsingError = errorMessage.includes("Unexpected token") || 
                                     errorMessage.includes("is not valid JSON");
        
        // In production, fallback to Gemini instead of returning error
        if (isProduction) {
          console.log("Production environment detected. Error in Imagen API. Falling back to Gemini model:", errorMessage);
          // Switch to Gemini model as fallback
          useGeminiFallback = true;
          model = "gemini";
        } else {
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
    }

    // For Gemini model or image editing
    // Get the model with the correct configuration for image generation
    console.log("Using Gemini model:", MODEL_ID);
    console.log("Image editing mode:", !!inputImage);

    // Configure the model with appropriate parameters
    const geminiConfig: any = {
      model: MODEL_ID,
      generationConfig: {
        temperature: inputImage ? 0.7 : 1, // Lower temperature for more predictable edits
        topP: 0.95,
        topK: 40,
        responseModalities: ["Text", "Image"], // Using any type avoids needing @ts-expect-error
      },
    };

    console.log("Using Gemini configuration:", JSON.stringify(geminiConfig, null, 2));

    const geminiModel = genAI.getGenerativeModel(geminiConfig);

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
        console.log("Image editing requires Gemini model, current model:", model);
        
        if (model !== "gemini") {
          console.warn("Incorrect model for image editing. Forcing to Gemini.");
          model = "gemini";
        }

        try {
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

          // Apply server-side optimization to ensure small file size
          console.log("Optimizing image on server before sending to API...");
          const optimizedImage = await optimizeImageServer(inputImage, 1024, 80);

          // Extract the base64 part after the comma
          const base64Index = optimizedImage.indexOf(';base64,');
          if (base64Index === -1) {
            console.error("Invalid image data URL format - missing base64 marker");
            return NextResponse.json(
              { error: "Invalid image data URL format" },
              { status: 400 }
            );
          }

          const base64Image = optimizedImage.substring(base64Index + 8);
          
          // Determine MIME type from the data URL
          const mimeMatch = optimizedImage.match(/data:([^;]+);base64,/);
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
        } catch (imgError) {
          console.error("Error processing input image for editing:", imgError);
          return NextResponse.json(
            { 
              error: "Failed to process input image", 
              details: imgError instanceof Error ? imgError.message : String(imgError) 
            },
            { status: 400 }
          );
        }
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

// Export configuration for Vercel optimization
export const config = {
  runtime: 'nodejs', // Use Node.js runtime instead of Edge runtime
  maxDuration: 60, // Set maximum duration to 60 seconds
};
