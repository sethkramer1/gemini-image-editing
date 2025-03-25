"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./ui/button";
import { Upload as UploadIcon, Image as ImageIcon, X, FileImage } from "lucide-react";
import { optimizeImage, formatFileSize, getDataUrlSize } from "@/lib/imageUtils";

interface ImageUploadProps {
  onImageSelect: (imageData: string) => void;
  currentImage: string | null;
}

export function ImageUpload({ onImageSelect, currentImage }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null);

  // Update the selected file when the current image changes
  useEffect(() => {
    if (!currentImage) {
      setSelectedFile(null);
      setOriginalSize(null);
      setOptimizedSize(null);
    }
  }, [currentImage]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);
      setProcessingImage(true);

      try {
        // Convert the file to base64
        const originalDataUrl = await readFileAsDataURL(file);
        
        // Set original size
        const origSize = getDataUrlSize(originalDataUrl);
        setOriginalSize(origSize);
        
        console.log("Original image loaded, type:", file.type);
        console.log("Original image size:", formatFileSize(origSize));
        
        // Optimize the image (resize and compress)
        const optimizedDataUrl = await optimizeImage(originalDataUrl, 1024, 0.85);
        
        // Set optimized size
        const optSize = getDataUrlSize(optimizedDataUrl);
        setOptimizedSize(optSize);
        
        console.log("Optimized image size:", formatFileSize(optSize));
        console.log("Size reduction:", Math.round((1 - optSize / origSize) * 100) + "%");
        
        // Provide the optimized image to the parent component
        onImageSelect(optimizedDataUrl);
      } catch (error) {
        console.error("Error processing image:", error);
      } finally {
        setProcessingImage(false);
      }
    },
    [onImageSelect]
  );

  // Helper function to read a file as data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          const result = event.target.result as string;
          
          // Validate the data URL format
          if (!result.startsWith('data:') || !result.includes(';base64,')) {
            reject(new Error("Generated invalid data URL format"));
            return;
          }
          
          resolve(result);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': []
    },
    maxFiles: 1,
    multiple: false,
    disabled: processingImage
  });

  const handleRemove = () => {
    setSelectedFile(null);
    setOriginalSize(null);
    setOptimizedSize(null);
    onImageSelect("");
  };

  return (
    <div className="space-y-4">
      {!currentImage ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-8
            flex flex-col items-center justify-center
            transition-all duration-200
            cursor-pointer
            ${processingImage ? "opacity-70 pointer-events-none" : ""}
            ${isDragActive 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-secondary/50"}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-secondary rounded-full">
              <FileImage className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">
                {processingImage 
                  ? "Optimizing image..." 
                  : "Drag and drop image here"}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports JPG, PNG, GIF, and WebP
              </p>
            </div>
            <Button
              size="sm"
              className="mt-4 hover-scale"
              disabled={processingImage}
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              Select Image
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          <div className="overflow-hidden rounded-lg shadow-md image-preview">
            <img
              src={currentImage}
              alt="Uploaded"
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2 opacity-90 hover:opacity-100 shadow-lg"
            onClick={handleRemove}
          >
            <X className="h-5 w-5" />
          </Button>
          {selectedFile && (
            <div className="bg-background/90 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full absolute bottom-3 left-3 border border-border shadow-sm">
              {selectedFile.name} 
              {originalSize && optimizedSize && (
                <span className="opacity-80 ml-1">
                  ({formatFileSize(optimizedSize)}, {Math.round((1 - optimizedSize / originalSize) * 100)}% smaller)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
