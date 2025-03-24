// Define the interface for conversation history items
export interface HistoryItem {
  // Role can be either "user" or "model"
  role: "user" | "model";
  // Parts can contain text and/or images
  parts: HistoryPart[];
}

// Define the interface for history parts
export interface HistoryPart {
  // Text content (optional)
  text?: string;
  // Image content as data URL (optional)
  // Format: data:image/png;base64,... or data:image/jpeg;base64,...
  image?: string;
  // Original uncompressed image for in-session use (optional)
  originalImage?: string;
  // Flag to indicate if the image is a URL rather than base64 data
  isImageUrl?: boolean;
}

// Note: When sending to the Gemini API:
// 1. User messages can contain both text and images (as inlineData)
// 2. Model messages should only contain text parts
// 3. Images in history are stored as data URLs in our app, but converted to base64 for the API
// 4. For storage efficiency, images may be compressed in localStorage with the original kept in memory
