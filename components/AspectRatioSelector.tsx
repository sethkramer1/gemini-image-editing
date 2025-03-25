import React, { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

// List of valid aspect ratios for Imagen API
export const VALID_ASPECT_RATIOS: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
}

const AspectRatioBox = ({ ratio }: { ratio: AspectRatio }) => {
  // Define width and height for each ratio visualization
  let style: React.CSSProperties = { 
    display: "inline-block",
    backgroundColor: "currentColor", 
    opacity: 0.5,
    marginRight: "6px"
  };

  switch (ratio) {
    case "1:1":
      style = { ...style, width: "14px", height: "14px" };
      break;
    case "3:4":
      style = { ...style, width: "12px", height: "16px" };
      break;
    case "4:3":
      style = { ...style, width: "16px", height: "12px" };
      break;
    case "9:16":
      style = { ...style, width: "9px", height: "16px" };
      break;
    case "16:9":
      style = { ...style, width: "16px", height: "9px" };
      break;
  }

  return <div style={style} className="rounded-sm"></div>;
};

export function AspectRatioSelector({
  selectedRatio,
  onRatioChange,
  disabled = false,
}: AspectRatioSelectorProps) {
  // Validate the selected ratio on mount and when it changes
  useEffect(() => {
    // If the selected ratio is not valid, default to 1:1
    if (!VALID_ASPECT_RATIOS.includes(selectedRatio)) {
      console.warn(`Invalid aspect ratio: ${selectedRatio}, defaulting to 1:1`);
      onRatioChange("1:1");
    }
  }, [selectedRatio, onRatioChange]);

  const handleRatioChange = (value: string) => {
    // Ensure the value is a valid aspect ratio
    if (VALID_ASPECT_RATIOS.includes(value as AspectRatio)) {
      onRatioChange(value as AspectRatio);
    } else {
      console.warn(`Invalid aspect ratio: ${value}, defaulting to 1:1`);
      onRatioChange("1:1");
    }
  };

  return (
    <div className="w-full max-w-[120px]">
      <Select
        disabled={disabled}
        value={selectedRatio}
        onValueChange={handleRatioChange}
      >
        <SelectTrigger className="h-8 text-xs bg-background">
          <SelectValue placeholder="Aspect ratio">
            <div className="flex items-center">
              <AspectRatioBox ratio={selectedRatio} />
              <span>{selectedRatio}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1:1" className="flex items-center">
            <div className="flex items-center">
              <AspectRatioBox ratio="1:1" />
              <span>1:1 (Square)</span>
            </div>
          </SelectItem>
          <SelectItem value="3:4" className="flex items-center">
            <div className="flex items-center">
              <AspectRatioBox ratio="3:4" />
              <span>3:4 (Portrait)</span>
            </div>
          </SelectItem>
          <SelectItem value="4:3" className="flex items-center">
            <div className="flex items-center">
              <AspectRatioBox ratio="4:3" />
              <span>4:3 (Landscape)</span>
            </div>
          </SelectItem>
          <SelectItem value="9:16" className="flex items-center">
            <div className="flex items-center">
              <AspectRatioBox ratio="9:16" />
              <span>9:16 (Portrait)</span>
            </div>
          </SelectItem>
          <SelectItem value="16:9" className="flex items-center">
            <div className="flex items-center">
              <AspectRatioBox ratio="16:9" />
              <span>16:9 (Landscape)</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
} 