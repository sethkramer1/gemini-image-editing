"use client";
import { useState, useEffect, useRef } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { ImagePromptInput } from "@/components/ImagePromptInput";
import { ImageResultDisplay } from "@/components/ImageResultDisplay";
import { ImageIcon, Wand2, RotateCcw, Plus } from "lucide-react";
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
  const isEditing = !!image || !!generatedImage;
  const displayImage = generatedImage;
  
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

  const handlePromptSubmit = async (prompt: string) => {
    try {
      // Reset any previous errors
      setError(null);
      
      // Set loading state
      setLoading(true);
      
      // Start tracking loading time
      setLoadingTime(0);
      const interval = setInterval(() => {
        setLoadingTime(prev => prev + 1);
      }, 1000);
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
        isEditing
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
      setLoading(false); // Stop loading immediately when we get a response

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error Response:", errorData);
        throw new Error(
          errorData.details || errorData.error || `Server error: ${response.status}`
        );
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
        // Update the generated image and description
        setGeneratedImage(data.image);
        setDescription(data.description || null);

        // Add AI response
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
        
        // Save to Supabase
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
    } finally {
      setLoading(false);
      if (loadingInterval) {
        clearInterval(loadingInterval);
        setLoadingInterval(null);
      }
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
    <main className="min-h-screen flex items-center justify-center bg-background p-0">
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
      
      <div className={`transition-all duration-300 ${sidebarExpanded ? 'pl-64 md:pl-64' : 'pl-0'} w-full flex justify-center h-screen overflow-hidden`}>
        <div className="w-full max-w-4xl flex flex-col h-full">
          <header className="h-16 border-b flex items-center px-4 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleReset}
              className="mr-auto h-8 w-8"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-foreground">
              <Wand2 className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">Gemini Image Creation & Editing</h1>
            </div>
            <div className="ml-auto w-8" />
          </header>
          
          <div className="flex-1 overflow-hidden relative">
            <div ref={scrollContainerRef} className="absolute inset-0 overflow-y-auto pb-[140px]">
              <div className="min-h-full flex flex-col justify-end">
                <div className="p-4">
                  {error && (
                    <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Show the upload view only if there's no history */}
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
                      <Card className="w-full max-w-4xl">
                        <CardHeader className="pb-2">
                          <CardTitle>Start by uploading an image or creating a new one</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                          <ImageUpload
                            onImageSelect={handleImageSelect}
                            currentImage={currentImage}
                          />
                          <ImagePromptInput
                            onSubmit={handlePromptSubmit}
                            isEditing={isEditing}
                            isLoading={loading}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <>
                      <ImageResultDisplay
                        imageUrl={displayImage || ""}
                        description={description}
                        onReset={handleReset}
                        onNewConversation={handleNewConversationWithCurrentImage}
                        conversationHistory={history}
                        isPastConversation={currentConversationIndex !== -1}
                        isLoading={loading}
                        loadingMessage={error?.includes("Loading image") 
                          ? "Converting image for editing..." 
                          : "Processing your request..."}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Fixed input area at the bottom when in chat mode */}
          {history.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t shadow-md">
              <div className={`transition-all duration-300 ${sidebarExpanded ? 'pl-64 md:pl-64' : 'pl-0'} w-full flex justify-center`}>
                <div className="w-full max-w-4xl px-4 py-4">
                  <ImagePromptInput
                    onSubmit={handlePromptSubmit}
                    isEditing={isEditing}
                    isLoading={loading}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
