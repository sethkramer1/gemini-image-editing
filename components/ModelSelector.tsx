import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type GenerationModel = "gemini" | "imagen-3";

interface ModelSelectorProps {
  selectedModel: GenerationModel;
  onModelChange: (model: GenerationModel) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <div className="w-full max-w-[200px]">
      <Select
        disabled={disabled}
        value={selectedModel}
        onValueChange={(value) => onModelChange(value as GenerationModel)}
      >
        <SelectTrigger className="h-8 text-xs bg-background">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="imagen-3">Imagen 3</SelectItem>
          <SelectItem value="gemini">Gemini</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
} 