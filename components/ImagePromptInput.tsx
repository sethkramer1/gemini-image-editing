"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Sparkles, Wand2, Image, MessageSquare, SendHorizonal, Type, Camera } from "lucide-react";
import { Textarea } from "./ui/textarea";

interface ImagePromptInputProps {
  onSubmit: (prompt: string) => void;
  isEditing: boolean;
  isLoading: boolean;
}

export function ImagePromptInput({
  onSubmit,
  isEditing,
  isLoading,
}: ImagePromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Auto-focus the textarea when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: add new line
        return;
      } else {
        // Enter: submit form if there's content
        e.preventDefault();
        if (prompt.trim() && !isLoading) {
          onSubmit(prompt.trim());
          setPrompt("");
        }
      }
    }
  };

  const promptPlaceholders = [
    isEditing
      ? "Describe how you want to edit the image..."
      : "Describe the image you want to generate...",
    isEditing 
      ? "Change the background to a serene beach..." 
      : "A modern house in a forest setting...",
    isEditing
      ? "Make it look like a painting by Monet..." 
      : "A professional portrait of a fashion model..."
  ];

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="flex flex-col rounded-xl border border-input bg-background shadow-xl overflow-hidden">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            id="prompt"
            className="min-h-[90px] text-base px-4 py-3.5 pr-14 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            placeholder={promptPlaceholders[0]}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          
          <Button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            size="icon"
            className="absolute right-3 bottom-3 size-9 rounded-full shadow-sm hover-scale"
            variant={isLoading ? "outline" : "default"}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="flex items-center justify-between bg-background/95 border-t border-border py-2 px-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              disabled={isLoading}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Suggest prompts
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground flex items-center">
            <Type className="h-3 w-3 mr-1.5" />
            <span>Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </form>
  );
}
