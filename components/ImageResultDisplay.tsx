"use client";

import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Copy, Share2, SaveAll, Sparkles, Clock, Loader2, FileImage, User } from "lucide-react";
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
      const response = await fetch(imageUrl);
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
    <div className="rounded-xl border border-border shadow-sm bg-card overflow-hidden">
      {/* Main content area */}
      <div className="p-1 sm:p-2 flex flex-col">
        {/* Image display with action buttons*/}
        <div className="rounded-lg overflow-hidden relative group">
          <img 
            src={imageUrl} 
            alt={description || "Generated image"} 
            className="w-full h-auto object-contain max-h-[70vh] image-preview"
          />
          
          {/* Image Action Buttons */}
          <div className="absolute bottom-3 right-3 flex items-center space-x-2">
            <Button
              onClick={() => handleDownloadImage(imageUrl)}
              size="sm"
              variant="secondary"
              className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-md border border-border/50 hover-scale"
            >
              <Download className="h-4 w-4 mr-1" />
              <span>Save</span>
            </Button>
            
            <Button
              onClick={handleCopyToClipboard}
              size="icon"
              variant="secondary"
              className="rounded-full size-8 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md border border-border/50 hover-scale"
            >
              {copied ? <Sparkles className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="bg-card p-4 rounded-xl shadow-lg border border-border flex flex-col items-center space-y-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-foreground font-medium">{loadingMessage}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Description text */}
        {description && (
          <div className="mt-3 px-3 py-2 bg-muted/30 rounded-lg border border-border/50">
            <p className="text-sm text-foreground">{description}</p>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex justify-between mt-4 px-1">
          <Button 
            onClick={onReset} 
            variant="outline"
            size="sm"
            className="hover-scale border-border/60"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          {onNewConversation && (
            <Button
              onClick={handleEditAction}
              variant="default"
              size="sm"
              className="hover-scale"
            >
              <SaveAll className="h-4 w-4 mr-2" />
              New with this image
            </Button>
          )}
        </div>
      </div>
      
      {/* Optional history display */}
      {conversationHistory.length > 0 && (
        <div className="mt-4 border-t border-border bg-background/50 overflow-hidden">
          <div className="pt-4 px-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary/70" />
              <h3 className="text-sm font-semibold">Conversation History</h3>
            </div>
            <div className="text-xs text-muted-foreground">
              {conversationHistory.length} messages
            </div>
          </div>
          
          <div className="p-4 pt-2 space-y-4 max-h-[400px] overflow-y-auto"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--border) transparent'
            }}
          >
            {conversationHistory.map((item, itemIdx) => {
              const isUser = item.role === 'user';
              const hasImage = item.parts.some(part => part.image);
              const delayOffset = itemIdx * 100; // Staggered animation
              
              return (
                <div 
                  key={itemIdx} 
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} relative`}
                  style={fadeInAnimation(delayOffset)}
                >
                  {/* Avatar/Icon */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0 mt-1 border border-primary/20">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] ${
                    isUser 
                      ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-t-lg rounded-bl-lg' 
                      : 'bg-secondary text-secondary-foreground rounded-t-lg rounded-br-lg'
                    } px-4 py-2.5 shadow-sm ${hasImage ? 'max-w-[380px]' : ''}`}
                  >
                    {item.parts.map((part, partIdx) => (
                      <div key={partIdx}>
                        {part.text && (
                          <p className={`text-sm leading-relaxed ${isUser ? 'font-medium' : ''}`}>
                            {part.text}
                          </p>
                        )}
                        {part.image && (
                          <div className="mt-2 mb-1 rounded-md overflow-hidden bg-black/5 shadow-inner border border-border/50">
                            <img 
                              src={part.image} 
                              alt={`${isUser ? 'User' : 'AI'} image`}
                              className="w-full h-auto max-h-[260px] object-contain"
                              loading="lazy"
                            />
                            {isUserUploadedImage(item, part) && isFirstUserMessage(item, conversationHistory) && (
                              <div className="bg-background/90 backdrop-blur-sm text-xs py-1.5 px-3 font-medium flex items-center justify-center border-t border-border/40">
                                <FileImage className="h-3 w-3 text-primary mr-1.5" />
                                Original uploaded image
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Message timestamp */}
                    <div className={`text-[10px] mt-1 flex items-center ${isUser ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground justify-start'}`}>
                      {getMessageTime(itemIdx)}
                    </div>
                  </div>
                  
                  {/* User avatar */}
                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ml-2 flex-shrink-0 mt-1 border border-primary/20">
                      <User className="h-4 w-4 text-primary/80" />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
