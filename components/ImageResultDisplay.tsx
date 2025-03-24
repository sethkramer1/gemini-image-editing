"use client";

import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Copy } from "lucide-react";
import { HistoryItem, HistoryPart } from "@/lib/types";
import { useMemo, useEffect, useRef } from "react";

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

  // Function to scroll to bottom smoothly
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Function to download any image
  const handleDownloadImage = (imageUrl: string, fileName: string = "gemini-image") => {
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
    } else {
      // It's a data URL, download directly
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  // Function to handle edit action (works with both data URLs and image URLs)
  const handleEditAction = () => {
    if (onNewConversation) {
      onNewConversation();
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    // Small delay to ensure content is rendered
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [conversationHistory]);
  
  // Also auto-scroll when an AI response gets added (length changes from odd to even)
  useEffect(() => {
    // Only perform this check if we have messages and just received an AI response
    if (conversationHistory.length > 0 && conversationHistory.length % 2 === 0) {
      // This means we just received an AI response (user, then AI)
      scrollToBottom();
    }
  }, [conversationHistory.length]);

  // Group conversation messages by role - memoized to prevent recalculation on every render
  const groupedConversation = useMemo(() => {
    return conversationHistory.reduce<HistoryItem[][]>((acc, item, index) => {
      if (index === 0 || item.role !== conversationHistory[index - 1].role) {
        acc.push([item]);
      } else {
        acc[acc.length - 1].push(item);
      }
      return acc;
    }, []);
  }, [conversationHistory]);

  // Check if this was an image that was uploaded by the user or not
  const isUserUploadedImage = (item: HistoryItem, part: HistoryPart): boolean => {
    // If it's the first message in the conversation and it's a user message with an image,
    // it's likely an uploaded image that should be shown
    const itemIndex = conversationHistory.indexOf(item);
    return itemIndex <= 1 && item.role === "user";
  };

  // Check if it's the first user message in the conversation
  const isFirstUserMessage = (item: HistoryItem, conversationHistory: HistoryItem[]): boolean => {
    // Find the index of the first user message in the conversation
    const firstUserMessageIndex = conversationHistory.findIndex(msg => msg.role === "user");
    // Check if the current item is that first user message
    return conversationHistory.indexOf(item) === firstUserMessageIndex && item.role === "user";
  };

  return (
    <div className="space-y-4">
      {/* Conversation History in ChatGPT style */}
      <div className="space-y-8 pb-4">
        {groupedConversation.map((group, groupIndex) => {
          const isUser = group[0].role === "user";
          
          return (
            <div key={groupIndex} className="flex flex-col space-y-1">
              <div className={`text-sm font-medium ${isUser ? "text-right" : "text-left"} px-2`}>
                {isUser ? "You" : "Gemini"}
              </div>
              <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className="flex flex-col space-y-2 max-w-[85%]">
                  {group.map((item, itemIndex) => (
                    <div 
                      key={itemIndex}
                      className={`rounded-lg p-4 ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      } ${itemIndex === 0 && isUser ? "rounded-tr-none" : ""} ${itemIndex === 0 && !isUser ? "rounded-tl-none" : ""}`}
                    >
                      <div className="space-y-3">
                        {item.parts.map((part: HistoryPart, partIndex) => (
                          <div key={partIndex}>
                            {/* Always display text content regardless of user or model */}
                            {part.text && (
                              <p className="text-sm whitespace-pre-wrap">{part.text}</p>
                            )}
                            {/* For user messages, only show image if it's the first user message in the conversation */}
                            {part.image && (!isUser || (isUser && isFirstUserMessage(item, conversationHistory))) && (
                              <div className="mt-2 overflow-hidden rounded-md relative group">
                                <img
                                  src={part.image}
                                  alt={isUser ? "User uploaded image" : "Generated image"}
                                  className="max-w-full max-h-[400px] w-auto h-auto object-contain mx-auto"
                                />
                                {/* Control buttons overlay */}
                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleDownloadImage(part.image || "")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  {!isUser && isPastConversation && onNewConversation && (
                                    <Button 
                                      variant="secondary" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={handleEditAction}
                                      title="Edit in New Chat"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Loading indicator - shown below the last message */}
        {isLoading && (
          <div className="flex justify-start mt-4">
            <div className="bg-secondary rounded-lg p-4 max-w-[85%] flex items-center space-x-3 border border-primary/20 shadow-sm">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span className="text-sm font-medium ml-2">{loadingMessage}</span>
            </div>
          </div>
        )}
        
        {/* Invisible element at the bottom for auto-scrolling */}
        <div ref={messagesEndRef} style={{ height: 20, width: '100%' }} />
      </div>
    </div>
  );
}
