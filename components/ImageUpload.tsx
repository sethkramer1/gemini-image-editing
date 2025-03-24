"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./ui/button";
import { Upload as UploadIcon, Image as ImageIcon, X, FileImage } from "lucide-react";

interface ImageUploadProps {
  onImageSelect: (imageData: string) => void;
  currentImage: string | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
}

export function ImageUpload({ onImageSelect, currentImage }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Update the selected file when the current image changes
  useEffect(() => {
    if (!currentImage) {
      setSelectedFile(null);
    }
  }, [currentImage]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);

      // Convert the file to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          const result = event.target.result as string;
          console.log("Image loaded, type:", file.type);
          console.log("Image loaded, size:", file.size);
          console.log("Image data URL format:", result.substring(0, 50) + "...");
          
          // Validate the data URL format
          if (!result.startsWith('data:') || !result.includes(';base64,')) {
            console.error("Generated invalid data URL format");
            return;
          }
          
          onImageSelect(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

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
  });

  const handleRemove = () => {
    setSelectedFile(null);
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
              <p className="font-medium">Drag and drop image here</p>
              <p className="text-sm text-muted-foreground">
                Supports JPG, PNG, GIF, and WebP
              </p>
            </div>
            <Button
              size="sm"
              className="mt-4 hover-scale"
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
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
