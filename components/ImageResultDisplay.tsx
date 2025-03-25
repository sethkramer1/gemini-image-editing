"use client";

import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Copy, Share2, SaveAll, Sparkles, Clock, Loader2, FileImage, User, ChevronLeft, ChevronRight } from "lucide-react";
import { HistoryItem, HistoryPart } from "@/lib/types";
import { useMemo, useEffect, useRef, useState } from "react";

interface ImageResultDisplayProps {
  imageUrl: string;
  description: string | null;
  onReset: () => void;
  onNewConversation?: () => void;
  conversationHistory?: HistoryItem[];
  isPastConversation?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
}

// Improved animations with fade-in effect for messages
const fadeInAnimation = (delay: number = 0) => {
  return {
    animation: `fadeIn 0.3s ease forwards`,
    animationDelay: `${delay}ms`,
    opacity: 0
  };
};

export function ImageResultDisplay({
  imageUrl,
  description,
  onReset,
  onNewConversation,
  conversationHistory = [],
  isPastConversation = false,
  isLoading = false,
  loadingMessage = "Processing your request..."
}: ImageResultDisplayProps) {
  // Reference to the message container for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  
  // Image navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageHistory, setImageHistory] = useState<string[]>([]);

  // Extract all images from the conversation history
  useEffect(() => {
    if (imageUrl && !imageHistory.includes(imageUrl)) {
      setImageHistory(prev => [...prev, imageUrl]);
      setCurrentImageIndex(prev => prev === 0 ? 0 : prev + 1);
    }
  }, [imageUrl]);

  // Extract all images from conversation history
  useEffect(() => {
    if (conversationHistory.length > 0) {
      const extractedImages: string[] = [];
      
      // Go through all conversation history and extract images
      conversationHistory.forEach(item => {
        item.parts.forEach(part => {
          if ('image' in part && part.image && !extractedImages.includes(part.image)) {
            extractedImages.push(part.image);
          }
        });
      });
      
      // Add the current imageUrl if it's not already included
      if (imageUrl && !extractedImages.includes(imageUrl)) {
        extractedImages.push(imageUrl);
      }
      
      if (extractedImages.length > 0) {
        setImageHistory(extractedImages);
        // Set to the last image (most recent)
        setCurrentImageIndex(extractedImages.length - 1);
      }
    }
  }, [conversationHistory, imageUrl]);

  // Navigation functions
  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < imageHistory.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  // The current image to display
  const currentDisplayImage = imageHistory[currentImageIndex] || imageUrl;
  
  // Function to scroll to bottom smoothly
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Function to download any image
  const handleDownloadImage = (imageUrl: string, fileName: string = "imagecraft-edit") => {
    // Check if this is a URL rather than a data URL
    if (imageUrl.startsWith('http')) {
      console.log("Downloading image from URL:", imageUrl);
      
      // Create a temporary link to download the image
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${fileName}.png`;
      link.target = "_blank"; // Open in new tab for URL downloads
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    // For data URLs, we can directly trigger download
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Function to copy image to clipboard
  const handleCopyToClipboard = async () => {
    try {
      // Fetch the image as a blob
      const response = await fetch(currentDisplayImage);
      const blob = await response.blob();
      
      // Create a ClipboardItem and write to clipboard
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image: ', err);
    }
  };

  // Auto-scroll on history updates
  useEffect(() => {
    if (conversationHistory.length > 0) {
      scrollToBottom();
    }
  }, [conversationHistory]);

  // Handle reset and new conversation actions
  const handleEditAction = () => {
    if (onNewConversation) {
      onNewConversation();
    }
  };

  // Check if an item is a user-uploaded image (typically the first image in conversation)
  const isUserUploadedImage = (item: HistoryItem, part: HistoryPart): boolean => {
    return item.role === 'user' && !!part.image;
  };

  // Check if this is the first user message in the conversation
  const isFirstUserMessage = (item: HistoryItem, conversationHistory: HistoryItem[]): boolean => {
    return (
      item.role === 'user' &&
      conversationHistory.findIndex(h => h.role === 'user') === conversationHistory.indexOf(item)
    );
  };

  // Format a fake timestamp for display purposes
  const getMessageTime = (index: number): string => {
    const now = new Date();
    const minutes = Math.max(0, 10 - index * 2);
    now.setMinutes(now.getMinutes() - minutes);
    return now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="flex flex-col relative w-full !p-0 !m-0 !border-0">
      {/* Image display with overlaid controls */}
      <div className="w-full relative !p-0 !m-0">
        {/* Image */}
        <img 
          src={currentDisplayImage} 
          alt={description || "Generated image"} 
          className="w-full object-contain !max-h-[80vh]" 
        />
        
        {/* Top navigation arrows */}
        <div className="flex items-center justify-between absolute top-0 left-0 right-0 z-50">
          <Button
            onClick={goToPreviousImage}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 m-0 rounded-none bg-white/20 hover:bg-white/30 text-white shadow-md"
            disabled={currentImageIndex <= 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button
            onClick={goToNextImage}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 m-0 rounded-none bg-white/20 hover:bg-white/30 text-white shadow-md"
            disabled={currentImageIndex >= imageHistory.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Save button directly at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-50 flex justify-center">
          <Button
            onClick={() => handleDownloadImage(currentDisplayImage)}
            size="sm"
            variant="ghost"
            className="rounded-none py-1 px-4 w-auto bg-white/20 hover:bg-white/30 text-white shadow-md"
          >
            <span>Save</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
