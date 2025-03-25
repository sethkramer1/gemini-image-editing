/**
 * Image utility functions for processing and optimizing images
 */

/**
 * Optimizes an image by resizing and compressing it while maintaining quality
 * @param dataUrl The image as a data URL
 * @param maxWidth Maximum width for the image in pixels
 * @param quality JPEG quality (0-1)
 * @returns A promise that resolves to the optimized image as a data URL
 */
export async function optimizeImage(
  dataUrl: string,
  maxWidth: number = 1024,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create an image to load the data URL
      const img = new Image();
      
      // Set up onload handler
      img.onload = () => {
        // Create a canvas to draw the resized image
        const canvas = document.createElement('canvas');
        
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        // Only resize if the image is larger than maxWidth
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image to the canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with specified quality
        // Extract the original mime type
        const mimeMatch = dataUrl.match(/data:([^;]+);base64,/);
        const originalMimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        
        // Use JPEG for best compression, unless it's a PNG with transparency
        const outputType = originalMimeType === "image/png" ? "image/png" : "image/jpeg";
        
        // Get the optimized data URL
        const optimizedDataUrl = canvas.toDataURL(outputType, quality);
        
        // Resolve with the new data URL
        resolve(optimizedDataUrl);
      };
      
      // Set up error handler
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Load the image
      img.src = dataUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Gets the size of a data URL in bytes
 * @param dataUrl The data URL
 * @returns The size in bytes
 */
export function getDataUrlSize(dataUrl: string): number {
  // Extract the base64 data
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) return 0;
  
  // Base64 uses 4 characters per 3 bytes
  return Math.floor((base64Data.length * 3) / 4);
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes The size in bytes
 * @returns A formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
} 