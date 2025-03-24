"use client";

import { HistoryItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, ChevronRight, ChevronLeft, Trash2, Loader2, Clock, LayoutGrid, FileImage, ChevronsLeft, Plus } from "lucide-react";
import { useState, useEffect } from "react";

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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  
  // Reset confirmation state when sidebar is closed
  useEffect(() => {
    if (!expanded) {
      setConfirmDelete(null);
    }
  }, [expanded]);

  // Get preview text from conversation
  const getConversationTitle = (conversation: HistoryItem[]): string => {
    // Find the first user message with text
    const userMessage = conversation.find(
      (msg) => msg.role === "user" && msg.parts.some((part) => part.text)
    );
    
    if (userMessage) {
      const textPart = userMessage.parts.find((part) => part.text);
      if (textPart?.text) {
        // Limit the length for display
        return textPart.text.length > 25
          ? textPart.text.substring(0, 25) + "..."
          : textPart.text;
      }
    }
    
    return "Untitled conversation";
  };

  return (
    <div
      className={`fixed top-16 bottom-0 left-0 bg-card shadow-md border-r border-border transition-all duration-300 flex flex-col z-10 ${
        expanded ? "w-72" : "w-0 opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Conversations</h2>
        </div>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar} 
            className="h-8 w-8"
            title="Close sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-1.5 py-2">
        <div className="space-y-1.5">
          {isLoading ? (
            <div className="p-6 flex flex-col items-center justify-center text-xs text-muted-foreground space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
              <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary rounded-full">
                <MessageCircle className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs text-muted-foreground">
                Upload an image or enter a prompt to get started
              </p>
            </div>
          ) : (
            conversations.map((conversation, index) => {
              const isActive = index === currentConversationIndex;
              const hasImage = conversation.some(msg => 
                msg.parts.some(part => part.image)
              );
              const title = getConversationTitle(conversation);
              
              return (
                <div key={index} className="relative">
                  <button
                    onClick={() => onSelectConversation(index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`
                      w-full text-left px-3 py-2 rounded-md text-sm
                      transition-colors duration-200
                      hover:bg-secondary
                      focus:outline-none focus:ring-1 focus:ring-primary/40
                      ${isActive ? 'bg-secondary border-l-2 border-primary' : ''}
                    `}
                  >
                    <div className="flex items-center space-x-2">
                      {hasImage ? (
                        <FileImage className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>
                        {title}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {conversation.length} messages
                      </span>
                    </div>
                  </button>
                  
                  {onDeleteConversation && (hoveredIndex === index || confirmDelete === index) && (
                    <div className="absolute right-1 top-1 flex space-x-1">
                      {confirmDelete === index ? (
                        <>
                          <Button
                            onClick={() => {
                              onDeleteConversation(index);
                              setConfirmDelete(null);
                            }}
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-xs"
                          >
                            Delete
                          </Button>
                          <Button
                            onClick={() => setConfirmDelete(null)}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setConfirmDelete(index)}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-70 hover:opacity-100 bg-background/80"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
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
    <div className="fixed left-0 top-[72px] z-20">
      <Button
        onClick={onClick}
        variant="secondary"
        size="sm"
        className={`h-8 pl-2 pr-3 rounded-l-none rounded-r-md border border-l-0 border-border/60 shadow-md bg-card/95 backdrop-blur-sm transition-all duration-300 ${expanded ? 'opacity-0 -translate-x-full' : 'opacity-100'}`}
      >
        <ChevronRight className="h-4 w-4 mr-1.5" />
        <span className="text-xs font-medium">Conversations</span>
      </Button>
    </div>
  );
} 