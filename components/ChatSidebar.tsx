"use client";

import { HistoryItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, ChevronRight, ChevronLeft, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

interface ChatSidebarProps {
  conversations: HistoryItem[][];
  currentConversationIndex: number;
  onSelectConversation: (index: number) => void;
  onClearHistory: () => void;
  onDeleteConversation?: (index: number) => void;
  expanded: boolean;
  toggleSidebar: () => void;
  isLoading?: boolean;
}

export function ChatSidebar({
  conversations,
  currentConversationIndex,
  onSelectConversation,
  onClearHistory,
  onDeleteConversation,
  expanded,
  toggleSidebar,
  isLoading = false,
}: ChatSidebarProps) {
  return (
    <div
      className={`fixed top-0 bottom-0 left-0 bg-background border-r border-border transition-all duration-300 flex flex-col z-10 ${
        expanded ? "w-64" : "w-0"
      }`}
    >
      <div className="flex items-center justify-between p-4 h-16 border-b border-border">
        <h2 className="text-sm font-medium">Chat History</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onClearHistory} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading ? (
            <div className="p-4 flex flex-col items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mb-2" />
              <span>Loading conversations...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              No conversation history yet
            </div>
          ) : (
            conversations.map((conversation, index) => {
              // Find first user message to use as title
              const firstUserMsg = conversation.find(item => item.role === "user");
              const title = firstUserMsg?.parts[0]?.text || `Conversation ${index + 1}`;
              
              // Get the most recent image from any message in the conversation
              let imageUrl = null;
              // Reverse the conversation array to find the most recent image
              for (let i = conversation.length - 1; i >= 0; i--) {
                const item = conversation[i];
                const imagePart = item.parts.find(part => part.image);
                if (imagePart?.image) {
                  imageUrl = imagePart.image;
                  break;
                }
              }
              
              return (
                <div key={index} className="relative group">
                  <Button
                    variant={currentConversationIndex === index ? "secondary" : "ghost"}
                    className="w-full justify-start p-2 h-auto"
                    onClick={() => onSelectConversation(index)}
                  >
                    <div className="flex items-start gap-2 w-full overflow-hidden">
                      <MessageCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-xs font-medium truncate w-full text-left">
                          {title.length > 20 ? title.substring(0, 20) + "..." : title}
                        </span>
                        {imageUrl && (
                          <div className="mt-1 h-16 w-16 rounded overflow-hidden mx-auto">
                            <img 
                              src={imageUrl} 
                              alt="thumbnail" 
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                  {onDeleteConversation && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(index);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function SidebarToggle({ onClick, expanded }: { onClick: () => void, expanded: boolean }) {
  return (
    <Button 
      variant="outline" 
      size="icon" 
      className={`fixed left-2 top-4 z-10 ${expanded ? 'hidden' : 'flex'}`}
      onClick={onClick}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
} 