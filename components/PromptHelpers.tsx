"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  PaintBucket, 
  LayoutTemplate,
  Sparkles
} from "lucide-react";

interface PromptHelpersProps {
  onSelectHelper: (text: string) => void;
  isEditing: boolean;
}

export function PromptHelpers({ onSelectHelper, isEditing }: PromptHelpersProps) {
  const stylePresets = [
    { name: "Photorealistic", description: "in photorealistic style" },
    { name: "Oil Painting", description: "in the style of an oil painting" },
    { name: "Watercolor", description: "in watercolor style" },
    { name: "Anime", description: "in anime style" },
    { name: "3D Render", description: "as a 3D rendered image" },
    { name: "Sketch", description: "as a pencil sketch" },
    { name: "Neon", description: "with neon lighting effects" },
    { name: "Vintage", description: "in vintage film style" },
    { name: "Cinematic", description: "in cinematic style with dramatic lighting" },
    { name: "Comic Book", description: "in comic book style" },
    { name: "Minimalist", description: "in minimalist style" },
    { name: "Fantasy", description: "in fantasy art style" }
  ];

  const compositionTemplates = [
    { name: "Portrait", description: "a portrait shot of" },
    { name: "Landscape", description: "a wide landscape view of" },
    { name: "Close-up", description: "an extreme close-up of" },
    { name: "Aerial", description: "an aerial view of" },
    { name: "Side View", description: "a side view of" },
    { name: "Golden Hour", description: "during golden hour lighting" },
    { name: "Night Scene", description: "at night with moonlight" },
    { name: "Macro", description: "a macro photography shot of" },
    { name: "Silhouette", description: "as a silhouette against" },
    { name: "High Contrast", description: "with high contrast lighting" },
    { name: "Symmetrical", description: "with symmetrical composition" },
    { name: "Rule of Thirds", description: "composed using the rule of thirds" }
  ];

  // Function to prevent event propagation
  const handleButtonClick = (e: React.MouseEvent, helperText: string) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event propagation
    onSelectHelper(helperText);
  };

  return (
    <div className="w-full border-t border-border pt-2 pb-1 px-3 bg-background/95 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Prompt Helpers</span>
      </div>
      
      <Tabs defaultValue="styles" className="w-full">
        <TabsList className="mb-2 h-8">
          <TabsTrigger value="styles" className="text-xs flex items-center gap-1.5">
            <PaintBucket className="h-3.5 w-3.5" />
            Style Presets
          </TabsTrigger>
          <TabsTrigger value="compositions" className="text-xs flex items-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Composition
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="styles" className="m-0">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {stylePresets.map((style) => (
              <Button
                key={style.name}
                variant="outline"
                size="sm"
                className="h-auto py-1.5 text-xs"
                onClick={(e) => handleButtonClick(e, style.description)}
                type="button" // Explicitly set button type to avoid form submission
              >
                {style.name}
              </Button>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="compositions" className="m-0">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
            {compositionTemplates.map((comp) => (
              <Button
                key={comp.name}
                variant="outline"
                size="sm"
                className="h-auto py-1.5 text-xs"
                onClick={(e) => handleButtonClick(e, comp.description)}
                type="button" // Explicitly set button type to avoid form submission
              >
                {comp.name}
              </Button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 