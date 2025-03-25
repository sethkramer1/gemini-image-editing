"use client";
import { useState, useEffect, useRef } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { ImagePromptInput } from "@/components/ImagePromptInput";
import { ImageResultDisplay } from "@/components/ImageResultDisplay";
import { ImageIcon, Wand2, RotateCcw, Plus, Clock, Sparkles, FileImage, Download, Copy, User, Loader2, SaveAll } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoryItem } from "@/lib/types";
import { ChatSidebar, SidebarToggle } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { Conversation } from "@/lib/supabase";
import { 
  getConversations, 
  loadConversationAsHistory, 
  convertAndSaveHistory, 
  deleteConversation,
  testSupabaseConnection
} from "@/lib/database";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function Home() {
  // Image state
  const [image, setImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Mode selection state
  const [mode, setMode] = useState("create");
  
  // Loading state
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTime, setLoadingTime] = useState(0);
  const [loadingInterval, setLoadingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Conversation state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [conversationsData, setConversationsData] = useState<Conversation[]>([]);
  const [allConversations, setAllConversations] = useState<HistoryItem[][]>([]);
  const [currentConversationIndex, setCurrentConversationIndex] = useState<number>(-1);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // UI state
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  
  // Auth state
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Derived properties - no state change
  const currentImage = generatedImage || image;
  const isEditing = !!image || !!generatedImage || mode === "edit";
  const displayImage = generatedImage;
  
  // New state
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auth redirect effect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
    }
  }, [user, authLoading, router]);
  
  // Load conversations effect
  useEffect(() => {
    async function loadConversations() {
      if (!user) {
        setConversationsData([]);
        setAllConversations([]);
        return;
      }
      
      setHistoryLoading(true);
      
      try {
        const conversations = await getConversations(user.id);
        setConversationsData(conversations);
        
        // Pre-load the first few conversations for better UX
        const preloadedConversations: HistoryItem[][] = [];
        for (let i = 0; i < Math.min(3, conversations.length); i++) {
          const history = await loadConversationAsHistory(conversations[i].id, user.id);
          preloadedConversations.push(history);
        }
        
        setAllConversations(preloadedConversations);
      } catch (error) {
        console.error('Failed to load conversations:', error);
        setError('Failed to load your conversation history');
      } finally {
        setHistoryLoading(false);
      }
    }
    
    loadConversations();
  }, [user]);
  
  // Handlers
  const handleImageSelect = (imageData: string) => {
    setImage(imageData || null);
  };

  const cancelRequest = () => {
    setLoading(false);
    if (loadingInterval) {
      clearInterval(loadingInterval);
      setLoadingInterval(null);
    }
    setError("Request canceled by user.");
  };

  const handlePromptSubmit = async (prompt: string, model?: string, aspectRatio?: string) => {
    try {
      // Reset any previous errors
      setError(null);
      
      // Set loading state
      setLoading(true);
      
      // Start tracking loading time with millisecond precision
      setLoadingTime(0);
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        setLoadingTime(elapsedSeconds);
      }, 100); // Update 10 times per second
      setLoadingInterval(interval);
      
      // Set a timeout in case the API takes too long
      const timeoutId = setTimeout(() => {
        console.log("Request taking longer than expected...");
        if (loading) {
          setError("Request is taking longer than expected. You may want to try again or modify your prompt.");
        }
      }, 30000); // 30 second timeout

      // If we have a generated image, use that for editing, otherwise use the uploaded image
      const imageToEdit = generatedImage || image;
      
      console.log("Submitting prompt:", prompt);
      console.log("Image editing mode:", isEditing);
      console.log("Has image to edit:", !!imageToEdit);
      console.log("Model:", model || "imagen-3 (default)");
      if (model === "imagen-3" && aspectRatio) {
        console.log("Aspect ratio selected:", aspectRatio);
        // Validate the aspect ratio
        const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
        if (!validAspectRatios.includes(aspectRatio)) {
          console.warn(`Invalid aspect ratio: ${aspectRatio}, defaulting to 1:1`);
          aspectRatio = "1:1";
        }
        console.log("Final aspect ratio being used:", aspectRatio);
      }
      
      // Preprocess the image (convert URL to base64 if needed)
      const validatedImage = await preprocessImage(imageToEdit);
      
      if (!validatedImage && imageToEdit) {
        // If we had an image but preprocessing failed
        setLoading(false);
        if (loadingInterval) {
          clearInterval(loadingInterval);
          setLoadingInterval(null);
        }
        return;
      }
      
      // Determine if we're editing based on image or mode
      const isEditingForApi = !!validatedImage || mode === "edit";
      
      // Force model to 'gemini' for editing
      const effectiveModel = isEditingForApi ? "gemini" : (model || "imagen-3");
      console.log("Effective model being used:", effectiveModel, isEditingForApi ? "(forced for image editing)" : "");
      
      // Create user message to add to history
      const userMessage: HistoryItem = {
        role: "user",
        parts: [
          { text: prompt },
        ],
      };
      
      // Only add image to the first user message in a conversation
      const hasExistingUserMessage = history.some(item => item.role === "user");
      if (imageToEdit && !hasExistingUserMessage) {
        userMessage.parts.push({ image: imageToEdit });
      }
      
      // Update history immediately with the user message
      const updatedHistory = [...history, userMessage];
      setHistory(updatedHistory);
      
      // Prepare the request data as JSON
      const requestData = {
        prompt,
        image: validatedImage,
        history: updatedHistory, // Use the updated history with user message
        isEditing: isEditingForApi,
        model: effectiveModel, // Use the effective model based on editing mode
        aspectRatio // Pass the aspect ratio parameter
      };

      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Clear the timeout and interval since we got a response
      clearTimeout(timeoutId);
      clearInterval(interval);
      setLoadingInterval(null);

      if (!response.ok) {
        const errorData = await response.json().catch(async (parseError) => {
          console.error("Response parse error:", parseError);
          // If JSON parsing fails, get the raw text
          const rawText = await response.text().catch(() => "Unknown error");
          return { error: "Server error", details: rawText };
        });
        
        console.error("API Error Response:", errorData);
        
        // Check if there's additional context about the error
        const errorMessage = errorData.details || errorData.error || `Server error: ${response.status}`;
        const additionalInfo = errorData.possibleCause ? `\n${errorData.possibleCause}` : '';
        
        throw new Error(errorMessage + additionalInfo);
      }

      const data = await response.json().catch((parseError) => {
        console.error("Response parse error:", parseError);
        console.error("Raw response:", response);
        throw new Error("Failed to parse response from server");
      });

      if (!data) {
        console.error("Empty response data");
        throw new Error("Empty response from server");
      }

      console.log("API response received:", {
        hasImage: !!data.image,
        imageDataLength: data.image ? data.image.length : 0,
        hasDescription: !!data.description,
        descriptionLength: data.description ? data.description.length : 0
      });

      if (data.image) {
        // First add the AI response to history
        const aiResponse: HistoryItem = {
          role: "model",
          parts: [
            ...(data.description ? [{ text: data.description }] : []),
            ...(data.image ? [{ image: data.image }] : []),
          ],
        };

        // Update history with AI response (user message was already added)
        const historyWithAiResponse = [...updatedHistory, aiResponse];
        setHistory(historyWithAiResponse);
        
        // Set the description
        setDescription(data.description || null);
        
        // Set the generated image right away so it displays immediately on both sides
        setGeneratedImage(data.image);
        
        // Set imageLoaded to true after setting the generated image
        setImageLoaded(true);
        
        // Set loading to false immediately after updating the UI
        setLoading(false);
        if (loadingInterval) {
          clearInterval(loadingInterval);
          setLoadingInterval(null);
        }

        // Save to Supabase (do this in the background)
        try {
          if (currentConversationId) {
            // We're updating an existing conversation
            await convertAndSaveConversation(historyWithAiResponse, currentConversationId);
          } else {
            // This is a new conversation
            const newConversationId = await convertAndSaveConversation(historyWithAiResponse);
            if (newConversationId && user) {
              setCurrentConversationId(newConversationId);
              
              // Refresh the conversations list
              const conversations = await getConversations(user.id);
              setConversationsData(conversations);
              
              // Update the index based on the new conversations data
              const newIndex = conversations.findIndex(c => c.id === newConversationId);
              setCurrentConversationIndex(newIndex !== -1 ? newIndex : 0);
              
              // Update allConversations array
              const newAllConversations = [...allConversations];
              newAllConversations[newIndex !== -1 ? newIndex : 0] = historyWithAiResponse;
              setAllConversations(newAllConversations);
            }
          }
        } catch (error) {
          console.error('Failed to save conversation to Supabase:', error);
          setError('Your conversation was generated but could not be saved to the database.');
        }
      } else {
        setError("No image returned from API");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Error processing request:", error);
      
      // Set loading to false only in error case
      setLoading(false);
      if (loadingInterval) {
        clearInterval(loadingInterval);
        setLoadingInterval(null);
      }
    } finally {
      // Nothing to do here as we handle both success and error cases individually
    }
  };

  const handleReset = () => {
    setImage(null);
    setGeneratedImage(null);
    setDescription(null);
    setLoading(false);
    setError(null);
    setHistory([]);
    setCurrentConversationIndex(-1);
    setCurrentConversationId(null);
  };
  
  const handleNewConversationWithCurrentImage = () => {
    // Reset everything except the current image
    const currentImg = generatedImage || image;
    setHistory([]);
    setCurrentConversationIndex(-1);
    setCurrentConversationId(null);
    
    // Keep just the image
    if (currentImg) {
      setImage(currentImg);
      setGeneratedImage(null);
    }
  };
  
  const handleSelectConversation = async (index: number) => {
    if (!user) return;
    
    try {
      if (index < 0 || index >= conversationsData.length) {
        throw new Error('Invalid conversation index');
      }
      
      // If we're already on this conversation, do nothing
      if (index === currentConversationIndex) {
        return;
      }
      
      // Show loading state
      setHistoryLoading(true);
      
      const conversationId = conversationsData[index].id;
      
      // Check if we have the conversation history loaded
      let conversationHistory: HistoryItem[];
      
      if (index < allConversations.length && allConversations[index].length > 0) {
        // Use cached data
        conversationHistory = allConversations[index];
      } else {
        // Load from Supabase
        conversationHistory = await loadConversationAsHistory(conversationId, user.id);
        
        // Update the allConversations array with this loaded data
        const newAllConversations = [...allConversations];
        while (newAllConversations.length <= index) {
          newAllConversations.push([]);
        }
        newAllConversations[index] = conversationHistory;
        setAllConversations(newAllConversations);
      }
      
      // Parse the conversation
      if (conversationHistory.length > 0) {
        // Reset the UI
        setImage(null);
        setGeneratedImage(null);
        setDescription(null);
        setError(null);
        
        // Find the last image in the conversation (from either user or model)
        let lastImage: string | null = null;
        
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          const item = conversationHistory[i];
          for (const part of item.parts) {
            if ('image' in part && part.image) {
              lastImage = part.image;
              break;
            }
          }
          if (lastImage) break;
        }
        
        if (lastImage) {
          // Set the image directly - we'll preprocess it when needed for editing
          setGeneratedImage(lastImage);
        }
        
        // Set the history
        setHistory(conversationHistory);
        
        // Update the current conversation tracking
        setCurrentConversationIndex(index);
        setCurrentConversationId(conversationId);
      } else {
        // If somehow we got an empty conversation, reset
        handleReset();
        setCurrentConversationIndex(-1);
        setCurrentConversationId(null);
        console.error('Retrieved an empty conversation');
      }
    } catch (error) {
      console.error('Error selecting conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setHistoryLoading(false);
    }
  };
  
  const handleClearHistory = async () => {
    if (!user) return;
    
    try {
      // Reset UI
      handleReset();
      
      // Reset conversation references
      setCurrentConversationIndex(-1);
      setCurrentConversationId(null);
      
      // Show loading state
      setHistoryLoading(true);
      
      // Reload conversation list (in case any were created but not shown)
      const conversations = await getConversations(user.id);
      setConversationsData(conversations);
      
      // Pre-load the first few conversations for better UX
      const preloadedConversations: HistoryItem[][] = [];
      for (let i = 0; i < Math.min(3, conversations.length); i++) {
        const history = await loadConversationAsHistory(conversations[i].id, user.id);
        preloadedConversations.push(history);
      }
      
      setAllConversations(preloadedConversations);
    } catch (error) {
      console.error("Error clearing history:", error);
      setError("Failed to clear history");
    } finally {
      setHistoryLoading(false);
    }
  };
  
  const handleDeleteConversation = async (index: number) => {
    if (!user) return;
    
    try {
      if (index < 0 || index >= conversationsData.length) {
        throw new Error('Invalid conversation index');
      }
      
      // Show loading state
      setHistoryLoading(true);
      
      const conversation = conversationsData[index];
      
      // Delete from database
      const success = await deleteConversation(conversation.id, user.id);
      
      if (!success) {
        throw new Error('Failed to delete conversation');
      }
      
      // Remove from local state
      const newConversationsData = [...conversationsData];
      newConversationsData.splice(index, 1);
      setConversationsData(newConversationsData);
      
      const newAllConversations = [...allConversations];
      if (index < newAllConversations.length) {
        newAllConversations.splice(index, 1);
        setAllConversations(newAllConversations);
      }
      
      // If we're deleting the current conversation, clear the UI
      if (index === currentConversationIndex) {
        handleReset();
        setCurrentConversationIndex(-1);
        setCurrentConversationId(null);
      } else if (index < currentConversationIndex) {
        // Adjust the index if we're deleting a conversation before the current one
        setCurrentConversationIndex(currentConversationIndex - 1);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation');
    } finally {
      setHistoryLoading(false);
    }
  };
  
  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  const convertAndSaveConversation = async (history: HistoryItem[], conversationId: string | null = null) => {
    if (!user) return null;
    
    try {
      const newConversationId = await convertAndSaveHistory(
        history,
        undefined,
        conversationId || undefined,
        user.id
      );

      if (newConversationId) {
        // Refresh conversations
        const conversations = await getConversations(user.id);
        setConversationsData(conversations);
        return newConversationId;
      } else {
        throw new Error('Failed to save conversation');
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
      setError('Failed to save your conversation');
      return null;
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Add effect to scroll to bottom when history changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [history]);

  // Function to check if an image is a URL
  const isImageUrl = (imageData: string | null): boolean => {
    return !!imageData && imageData.startsWith('http');
  };

  // No need for the URL warning useEffect as we'll process URLs automatically

  // Function to fetch a URL and convert it to base64
  const convertUrlToBase64 = async (url: string): Promise<string | null> => {
    try {
      console.log("Converting URL to base64:", url);
      setLoading(true);
      setError("Loading image data for editing... Please wait.");
      
      // Fetch the image
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLoading(false);
          setError(null); // Clear the loading message
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting URL to base64:", error);
      setLoading(false);
      setError("Failed to load the image. Please try downloading it manually.");
      return null;
    }
  };
  
  // Preprocess image before submitting
  const preprocessImage = async (imageUrl: string | null): Promise<string | null> => {
    if (!imageUrl) return null;
    
    // If it's already a data URL, return it directly
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // If it's a URL, convert it to base64
    if (imageUrl.startsWith('http')) {
      console.log("Converting image URL to base64 for editing");
      const base64Image = await convertUrlToBase64(imageUrl);
      if (base64Image) {
        // Update the state to use this converted image
        if (imageUrl === generatedImage) {
          setGeneratedImage(base64Image);
        } else if (imageUrl === image) {
          setImage(base64Image);
        }
        return base64Image;
      }
      return null;
    }
    
    return imageUrl;
  };

  // Function to check if an item is a user-uploaded image
  const isUserUploadedImage = (item: HistoryItem, part: any): boolean => {
    return item.role === 'user' && 'image' in part && !!part.image;
  };

  // Check if this is the first user message in the conversation
  const isFirstUserMessage = (item: HistoryItem, history: HistoryItem[]): boolean => {
    return (
      item.role === 'user' &&
      history.findIndex(h => h.role === 'user') === history.indexOf(item)
    );
  };

  // Function to copy image to clipboard
  const handleCopyToClipboard = async () => {
    if (!displayImage) return;
    
    try {
      // Fetch the image as a blob
      const response = await fetch(displayImage);
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

  // Reset image loaded state when the image changes
  useEffect(() => {
    if (displayImage) {
      // Don't reset imageLoaded to false, as we already set it to true in handlePromptSubmit
      // This was causing the loading indicator to briefly flash after setting generatedImage
      // setImageLoaded(false);
      
      // Let the img element's onLoad still set it to true as a fallback
      // This way we ensure the image is always shown properly
    }
  }, [displayImage]);

  // Render loading state if authentication is still loading
  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-indigo-600 rounded-full" role="status" aria-label="loading">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  // Main UI render
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0c0c0c] p-0">
      {/* Sidebar components */}
      <ChatSidebar 
        conversations={allConversations}
        currentConversationIndex={currentConversationIndex}
        onSelectConversation={handleSelectConversation}
        onClearHistory={handleClearHistory}
        onDeleteConversation={handleDeleteConversation}
        expanded={sidebarExpanded}
        toggleSidebar={toggleSidebar}
        isLoading={historyLoading}
      />
      
      <SidebarToggle onClick={toggleSidebar} expanded={sidebarExpanded} />
      
      <div className={`transition-all duration-300 w-full flex justify-center h-screen overflow-hidden ${sidebarExpanded ? 'pl-72' : 'pl-0'}`}>
        <div className="w-full max-w-7xl flex flex-col h-full">
          <header className="h-16 border-b border-gray-800 flex items-center px-4 flex-shrink-0 bg-[#111111]">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleReset}
              className="mr-auto h-8 w-8"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-white cursor-pointer" onClick={handleReset} title="New Chat">
              <Wand2 className="w-6 h-6 text-blue-500" />
              <h1 className="text-xl font-semibold">ImageCraft</h1>
            </div>
            <div className="ml-auto w-8" />
          </header>
          
          {history.length === 0 ? (
            // Initial upload view when no history
            <div className="flex-1 overflow-hidden relative">
              <div 
                ref={scrollContainerRef} 
                className="absolute inset-0 overflow-y-auto px-4 scroll-smooth"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--border) transparent'
                }}
              >
                <div className="min-h-full flex flex-col justify-center py-8">
                  {error && (
                    <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg shadow-sm border border-red-200">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center relative">
                    <Card className="w-full max-w-4xl shadow-lg">
                      <CardHeader className="pb-2">
                        <CardTitle>
                          {mode === "create" 
                            ? "Create a new image with AI" 
                            : "Upload an image to edit with AI"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-8 pt-6">
                        {/* Mode Selection Tabs */}
                        <div className="flex bg-[#111111] border border-gray-800 rounded-lg p-1">
                          <button
                            onClick={() => setMode("create")}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                              mode === "create" 
                                ? "bg-blue-600 text-white" 
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            <Wand2 className="h-4 w-4 inline-block mr-2" />
                            Create new image
                          </button>
                          <button
                            onClick={() => setMode("edit")}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                              mode === "edit" 
                                ? "bg-blue-600 text-white" 
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            <ImageIcon className="h-4 w-4 inline-block mr-2" />
                            Edit existing image
                          </button>
                        </div>
                        
                        {/* Only show image upload in edit mode */}
                        {mode === "edit" && (
                          <ImageUpload
                            onImageSelect={handleImageSelect}
                            currentImage={currentImage}
                          />
                        )}
                        
                        <ImagePromptInput
                          onSubmit={handlePromptSubmit}
                          isEditing={isEditing || mode === "edit"}
                          isLoading={loading}
                        />
                      </CardContent>
                    </Card>

                    {/* Loading overlay */}
                    {loading && (
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
                        <div className="bg-card p-6 rounded-xl shadow-lg border border-border flex flex-col items-center space-y-4">
                          <Loader2 className="h-10 w-10 text-primary animate-spin" />
                          <p className="text-foreground font-medium text-center">
                            {error?.includes("Loading image") 
                              ? "Converting image for editing..." 
                              : "Processing your request..."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(loadingTime)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Side-by-side layout when conversation has started
            <div className="flex-1 flex overflow-hidden">
              {/* Left side: Chat history and input */}
              <div className="w-1/2 border-r border-gray-800 flex flex-col bg-[#111111] relative">
                {/* Chat history */}
                <div className="flex-1 overflow-hidden">
                  <div 
                    ref={scrollContainerRef} 
                    className="absolute inset-0 overflow-y-auto px-4 scroll-smooth"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'var(--border) transparent',
                      paddingBottom: '130px'
                    }}
                  >
                    <div className="min-h-full flex flex-col py-4">
                      {error && (
                        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg shadow-sm border border-red-200">
                          {error}
                        </div>
                      )}
                      
                      {/* Conversation History Section */}
                      <div className="pt-4 px-1 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-primary/70" />
                          <h3 className="text-sm font-semibold">Conversation History</h3>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {history.length} messages
                        </div>
                      </div>
                      
                      <div className="p-2 space-y-4"
                        style={{
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'var(--border) transparent'
                        }}
                      >
                        {history.map((item, itemIdx) => {
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
                              
                              <div className={`${
                                isUser 
                                  ? 'bg-blue-600 text-white rounded-t-lg rounded-bl-lg' 
                                  : 'bg-gray-800 text-white rounded-t-lg rounded-br-lg'
                                } px-4 py-2.5 shadow-sm ${hasImage ? 'max-w-[300px]' : 'max-w-[85%]'}`}
                              >
                                {item.parts.map((part, partIdx) => (
                                  <div key={partIdx}>
                                    {part.text && (
                                      <p className="text-sm leading-relaxed font-medium">
                                        {part.text}
                                      </p>
                                    )}
                                    {part.image && (
                                      <div className="mt-2 mb-1 rounded-md overflow-hidden">
                                        <img 
                                          src={part.image} 
                                          alt={`${isUser ? 'User' : 'AI'} image`}
                                          className="w-full h-auto max-h-[180px] object-contain"
                                          loading="lazy"
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                                
                                {/* Message timestamp */}
                                <div className="text-[10px] mt-1 text-gray-300 text-right">
                                  {getMessageTime(itemIdx)}
                                </div>
                              </div>
                              
                              {/* User avatar */}
                              {isUser && (
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                                  <User className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} className="h-4" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Chat input fixed at bottom */}
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#111111] backdrop-blur-sm border-t border-gray-800 shadow-lg">
                  <div className="w-full px-4 py-3">
                    <ImagePromptInput
                      onSubmit={handlePromptSubmit}
                      isEditing={isEditing || mode === "edit"}
                      isLoading={loading}
                    />
                  </div>
                </div>
              </div>
              
              {/* Right side: Current image display */}
              <div className="w-1/2 flex flex-col bg-[#0c0c0c]">
                <div className="flex-1 overflow-auto flex items-center justify-center p-6">
                  <div className="h-full w-full flex flex-col">
                    {/* Current image with loading state */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center relative p-4">
                      {displayImage ? (
                        <img 
                          src={displayImage} 
                          alt={description || "Generated image"} 
                          className="max-w-full max-h-full object-contain image-preview"
                          onLoad={() => setImageLoaded(true)}
                        />
                      ) : (
                        <div className="text-gray-500 flex flex-col items-center justify-center">
                          <FileImage className="h-16 w-16 mb-4 opacity-20" />
                          <p>No image to display</p>
                        </div>
                      )}
                      
                      {/* Image Action Buttons */}
                      {displayImage && (
                        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                          <Button
                            onClick={() => handleDownloadImage(displayImage)}
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
                      )}
                      
                      {/* Loading overlay */}
                      {loading && (
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
                          <div className="bg-card p-6 rounded-xl shadow-lg border border-border flex flex-col items-center space-y-4">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            <p className="text-foreground font-medium text-center">
                              {error?.includes("Loading image") 
                                ? "Converting image for editing..." 
                                : "Processing your request..."}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(loadingTime)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Description text */}
                    {description && (
                      <div className="mt-3 mx-4 px-3 py-2 bg-muted/30 rounded-lg border border-border/50">
                        <p className="text-sm text-foreground">{description}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Helper function for fade-in animation
const fadeInAnimation = (delay: number = 0) => {
  return {
    animation: `fadeIn 0.3s ease forwards`,
    animationDelay: `${delay}ms`,
    opacity: 0
  };
};

// Format a timestamp for display purposes
const getMessageTime = (index: number): string => {
  const now = new Date();
  const minutes = Math.max(0, 10 - index * 2);
  now.setMinutes(now.getMinutes() - minutes);
  return now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
};

// Helper function for downloading images
const handleDownloadImage = (imageUrl: string, fileName: string = "imagecraft-edit") => {
  if (!imageUrl) return;
  
  // Check if this is a URL rather than a data URL
  if (imageUrl.startsWith('http')) {
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

// Format time in HH:MM:SS.ms format
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(secs).padStart(2, '0') + '.' + String(ms).padStart(3, '0')
  ].filter(Boolean).join(':');
};
