"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
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

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="flex flex-col rounded-xl border border-input bg-background shadow-sm overflow-hidden">
        <Textarea
          id="prompt"
          className="min-h-[80px] text-lg px-4 py-4 pr-16 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          placeholder={
            isEditing
              ? "Describe how you want to edit the image..."
              : "Describe the image you want to generate..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        
        <div className="flex items-center justify-end bg-background border-t border-border p-2 px-3">
          <Button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="rounded-full h-8 w-8 flex items-center justify-center"
            size="icon"
            variant={isLoading ? "outline" : "default"}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
