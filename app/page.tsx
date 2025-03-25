"use client";
import { useState, useEffect, useRef } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { ImagePromptInput } from "@/components/ImagePromptInput";
import { ImageResultDisplay } from "@/components/ImageResultDisplay";
import { ImageIcon, Wand2, RotateCcw, Plus, Clock, Sparkles, FileImage, Download, Copy, User, Loader2, SaveAll, ChevronLeft, ChevronRight } from "lucide-react";
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
import { AppShell } from "@/components/AppShell";
import { flushSync } from 'react-dom';
import { optimizeImage } from "@/lib/imageUtils";

export default function Home() {
  // Image state
  const [image, setImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  
  // Mode selection state
  const [mode, setMode] = useState("create");
  
  // Loading state
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState<number>(0);
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
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadedConversationsCount, setLoadedConversationsCount] = useState(0);
  
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Image navigation state
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Function to scroll to bottom immediately
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };
  
  // Add effect to scroll to end when messages change
  useEffect(() => {
    scrollToBottom();
  }, [history, generatedImage]);
  
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
        for (let i = 0; i < Math.min(10, conversations.length); i++) {
          const history = await loadConversationAsHistory(conversations[i].id, user.id);
          preloadedConversations.push(history);
        }
        
        setAllConversations(preloadedConversations);
        setLoadedConversationsCount(Math.min(10, conversations.length));
        setHasMoreConversations(conversations.length > 10);
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
      
      // Set loading state with flushSync to ensure immediate UI update
      const submissionId = Date.now(); // Create a unique ID for this submission
      console.log(`Starting edit submission ${submissionId}, setting loading=true`);
      
      // Force a synchronous update of loading state
      await new Promise<void>((resolve) => {
        flushSync(() => {
          setLoading(true);
          setLoadingTime(0);
          setLoadingKey(Date.now()); // Set a new unique key for this loading session
          resolve();
        });
      });
      
      // Start tracking loading time with millisecond precision
      const startTime = Date.now();
      const interval = setInterval(() => {
        setLoadingTime((Date.now() - startTime) / 1000);
      }, 100); // Update 10 times per second
      
      // Ensure interval is set in state before proceeding
      await new Promise<void>((resolve) => {
        flushSync(() => {
          setLoadingInterval(interval);
          resolve();
        });
      });
      
      // Use a small delay to ensure the loading state is applied before heavy processing begins
      await new Promise(resolve => setTimeout(resolve, 50));
      
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
      
      // If we got a processed image, update the state to use it
      if (validatedImage && validatedImage !== imageToEdit) {
        if (imageToEdit === generatedImage) {
          setGeneratedImage(validatedImage);
        } else if (imageToEdit === image) {
          setImage(validatedImage);
        }
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
      flushSync(() => {
        setHistory(updatedHistory);
      });
      
      // Scroll to bottom immediately to show user's message
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
      
      // Prepare the request data as JSON
      const requestData = {
        prompt,
        image: validatedImage,
        history: isEditingForApi ? [] : updatedHistory, // Only send history if not in editing mode
        isEditing: isEditingForApi,
        model: effectiveModel, // Use the effective model based on editing mode
        aspectRatio // Pass the aspect ratio parameter
      };

      console.log("Sending request to API:", {
        isEditing: isEditingForApi,
        historyLength: isEditingForApi ? "none (editing mode)" : updatedHistory.length,
        hasImage: !!validatedImage
      });

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
        
        // Set the description and generated image
        setDescription(data.description || null);
        setGeneratedImage(data.image);
        
        // Set loading to false after everything is updated
        setLoading(false);
        if (loadingInterval) {
          clearInterval(loadingInterval);
          setLoadingInterval(null);
        }

        // Save to Supabase (do this in the background)
        try {
          if (currentConversationId) {
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
      flushSync(() => {
        console.log(`Error in edit submission, setting loading=false`);
        setLoading(false);
        if (loadingInterval) {
          clearInterval(loadingInterval);
          setLoadingInterval(null);
        }
      });
    } finally {
      // Nothing to do here as we handle both success and error cases individually
    }
  };

  const handleReset = () => {
    setImage(null);
    setGeneratedImage(null);
    setDescription(null);
    setLoading(false);
    if (loadingInterval) {
      clearInterval(loadingInterval);
      setLoadingInterval(null);
    }
    setError(null);
    setHistory([]);
    setCurrentConversationIndex(-1);
    setCurrentConversationId(null);
    // Reset image navigation
    setImageHistory([]);
    setCurrentImageIndex(0);
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
        flushSync(() => {
          setImage(null);
          setGeneratedImage(null);
          setDescription(null);
          setError(null);
          setLoading(false);
          if (loadingInterval) {
            clearInterval(loadingInterval);
            setLoadingInterval(null);
          }
        });
        
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
    
    // Clear all history
    setHistory([]);
    setAllConversations([]);
    setConversationsData([]);
    setCurrentConversationIndex(-1);
    setCurrentConversationId(null);
    setLoadedConversationsCount(0);
    setHasMoreConversations(false);
    
    // Reset UI
    setImage(null);
    setGeneratedImage(null);
    setDescription(null);
    setLoading(false);
    if (loadingInterval) {
      clearInterval(loadingInterval);
      setLoadingInterval(null);
    }
    setError(null);
  };
  
  const handleDeleteConversation = async (index: number) => {
    if (!user) return;
    
    try {
      setHistoryLoading(true);
      
      // Get the conversation ID to delete
      const conversationId = conversationsData[index]?.id;
      if (!conversationId) {
        console.error("Cannot delete conversation: ID not found");
        return;
      }
      
      // Delete from database
      await deleteConversation(conversationId, user.id);
      
      // Update UI
      const updatedConversationsData = [...conversationsData];
      updatedConversationsData.splice(index, 1);
      setConversationsData(updatedConversationsData);
      
      const updatedConversations = [...allConversations];
      updatedConversations.splice(index, 1);
      setAllConversations(updatedConversations);
      
      // Update loaded conversation count
      setLoadedConversationsCount(prev => Math.max(0, prev - 1));
      
      // Check if we need to update hasMoreConversations
      setHasMoreConversations(updatedConversationsData.length > updatedConversations.length);
      
      // Handle current conversation selection
      if (currentConversationIndex === index) {
        // We're deleting the active conversation
        setCurrentConversationIndex(-1);
        setCurrentConversationId(null);
        setHistory([]);
        setGeneratedImage(null);
        setImage(null);
        setLoading(false);
        if (loadingInterval) {
          clearInterval(loadingInterval);
          setLoadingInterval(null);
        }
      } else if (currentConversationIndex > index) {
        // We're deleting a conversation before the current one
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

  const handleLoadMoreConversations = async () => {
    if (!user || !conversationsData || loadedConversationsCount >= conversationsData.length) {
      return;
    }
    
    setHistoryLoading(true);
    
    try {
      const moreConversations: HistoryItem[][] = [...allConversations];
      const nextBatchSize = Math.min(10, conversationsData.length - loadedConversationsCount);
      
      for (let i = loadedConversationsCount; i < loadedConversationsCount + nextBatchSize; i++) {
        const history = await loadConversationAsHistory(conversationsData[i].id, user.id);
        moreConversations.push(history);
      }
      
      setAllConversations(moreConversations);
      setLoadedConversationsCount(loadedConversationsCount + nextBatchSize);
      setHasMoreConversations(loadedConversationsCount + nextBatchSize < conversationsData.length);
    } catch (error) {
      console.error('Failed to load more conversations:', error);
      setError('Failed to load more conversations');
    } finally {
      setHistoryLoading(false);
    }
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

  // Add effect to scroll to bottom when history changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [history]);

  // Add additional effect to scroll when a new image is generated
  useEffect(() => {
    if (scrollContainerRef.current && generatedImage) {
      // Use setTimeout to ensure DOM has updated with the new image
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }, 200);
    }
  }, [generatedImage]);

  // Function to check if an image is a URL
  const isImageUrl = (imageData: string | null): boolean => {
    return !!imageData && imageData.startsWith('http');
  };

  // No need for the URL warning useEffect as we'll process URLs automatically

  // Function to fetch a URL and convert it to base64
  const convertUrlToBase64 = async (url: string): Promise<string | null> => {
    try {
      console.log("Converting URL to base64:", url);
      // Remove loading state management from here since it's handled by handlePromptSubmit
      
      // Fetch the image
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting URL to base64:", error);
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
        // Optimize the image after loading from URL
        console.log("Optimizing image loaded from URL");
        try {
          const optimizedImage = await optimizeImage(base64Image, 1024, 0.85);
          console.log("Image successfully optimized");
          
          // Return the optimized image without updating state here
          return optimizedImage;
        } catch (error) {
          console.error("Error optimizing image:", error);
          
          // Fall back to unoptimized image if optimization fails
          return base64Image;
        }
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

  // Function to copy the current image to clipboard
  const handleCopyToClipboard = async () => {
    try {
      // Get the current image to copy
      const imageToCopy = imageHistory[currentImageIndex] || displayImage;
      
      // Fetch the image as a blob
      const response = await fetch(imageToCopy);
      const blob = await response.blob();
      
      // Create a ClipboardItem and write to clipboard
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image: ', err);
      setError('Failed to copy image to clipboard');
    }
  };

  // Add effect to log loading state changes
  useEffect(() => {
    console.log('Loading state changed:', loading);
  }, [loading]);

  // Navigation functions
  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < imageHistory.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  // Update image history when new images are added to conversation history
  useEffect(() => {
    if (history.length > 0) {
      const extractedImages: string[] = [];
      
      // Extract images from conversation history
      history.forEach(item => {
        item.parts.forEach(part => {
          if ('image' in part && part.image && !extractedImages.includes(part.image)) {
            extractedImages.push(part.image);
          }
        });
      });
      
      // Only update if we have new images and avoid infinite loop by not depending on imageHistory
      const hasNewImages = extractedImages.length > 0 && 
        (extractedImages.length !== imageHistory.length || 
        extractedImages.some(img => !imageHistory.includes(img)));
        
      if (hasNewImages) {
        setImageHistory(extractedImages);
        setCurrentImageIndex(extractedImages.length - 1);
      }
    }
  }, [history]); // Remove imageHistory dependency to prevent infinite loop

  // Update image history when a new image is generated - in a separate effect
  useEffect(() => {
    if (generatedImage) {
      setImageHistory(prev => {
        // Only add if not already in the array
        if (prev.indexOf(generatedImage) === -1) {
          const newHistory = [...prev, generatedImage];
          // Update the current index in a way that doesn't depend on the previous state
          setCurrentImageIndex(newHistory.length - 1);
          return newHistory;
        }
        return prev;
      });
    }
  }, [generatedImage]); // Only depend on generatedImage

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
    <AppShell onNewProject={handleReset}>
      <div className="min-h-screen flex items-center justify-center bg-[#0c0c0c] p-0">
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
          onLoadMoreConversations={handleLoadMoreConversations}
          hasMoreConversations={hasMoreConversations}
        />
        
        <SidebarToggle onClick={toggleSidebar} expanded={sidebarExpanded} />
        
        <div className={`transition-all duration-300 w-full flex justify-center h-screen overflow-hidden ${sidebarExpanded ? 'pl-72' : 'pl-0'}`}>
          <div className="w-full max-w-7xl flex flex-col h-full">
            {history.length === 0 ? (
              // Initial upload view when no history
              <div className="flex-1 overflow-hidden relative">
                <div 
                  ref={scrollContainerRef} 
                  className="absolute inset-0 overflow-y-auto px-4 scroll-smooth"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--border) transparent',
                    paddingBottom: '130px',
                    scrollBehavior: 'auto'
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
                            key={`prompt-input-${loadingKey}`} 
                          />
                        </CardContent>
                      </Card>
                      
                      {/* Loading overlay */}
                      {loading && (
                        <div key={`loading-overlay-${loadingKey}`} className="absolute inset-0 bg-background/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
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
                        paddingBottom: '130px',
                        scrollBehavior: 'auto'
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
                                            onLoad={() => {
                                              // Scroll to bottom immediately after image loads
                                              if (scrollContainerRef.current) {
                                                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                                              }
                                              if (messagesEndRef.current) {
                                                messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                                              }
                                            }}
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
                        key={`prompt-input-${loadingKey}`} 
                      />
                    </div>
                  </div>
                </div>
                
                {/* Right side: Current image display */}
                <div className="w-1/2 flex flex-col bg-[#0c0c0c]">
                  <div className="flex-1 overflow-hidden flex items-center justify-center p-0 m-0">
                    <div className="w-full h-full flex flex-col p-0 m-0">
                      {/* Current image with loading state - remove padding */}
                      <div className="flex-1 flex items-center justify-center relative overflow-visible px-12 m-0">
                        {displayImage ? (
                          <div className="relative inline-block flex flex-col">
                            {/* Navigation Controls above image */}
                            <div className="flex items-center justify-between mb-4">
                              <Button
                                onClick={goToPreviousImage}
                                size="icon"
                                variant="ghost"
                                className="h-12 w-12 bg-transparent hover:bg-white/10 text-white"
                                disabled={currentImageIndex <= 0 || imageHistory.length <= 1}
                              >
                                <ChevronLeft className="h-8 w-8" />
                              </Button>
                              
                              <Button
                                onClick={goToNextImage}
                                size="icon"
                                variant="ghost"
                                className="h-12 w-12 bg-transparent hover:bg-white/10 text-white"
                                disabled={currentImageIndex >= imageHistory.length - 1 || imageHistory.length <= 1}
                              >
                                <ChevronRight className="h-8 w-8" />
                              </Button>
                            </div>
                            
                            {/* Image */}
                            <div>
                              <img 
                                src={imageHistory[currentImageIndex] || displayImage} 
                                alt={description || "Generated image"} 
                                className="block object-contain max-h-[calc(100vh-120px)] max-w-full"
                                onLoad={() => {
                                  // Scroll to bottom immediately after image loads
                                  if (scrollContainerRef.current) {
                                    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                                  }
                                  if (messagesEndRef.current) {
                                    messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                                  }
                                }}
                              />
                            </div>
                            
                            {/* Save Button below image */}
                            <div className="flex items-center justify-center mt-4">
                              <Button
                                onClick={() => handleDownloadImage(imageHistory[currentImageIndex] || displayImage)}
                                size="lg"
                                variant="ghost"
                                className="py-2 px-6 bg-transparent hover:bg-white/10 text-white text-lg"
                              >
                                <span>Save</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500 flex flex-col items-center justify-center">
                            <FileImage className="h-16 w-16 mb-4 opacity-20" />
                            <p>No image to display</p>
                          </div>
                        )}
                        
                        {/* Loading overlay */}
                        {loading && (
                          <div key={`loading-overlay-image-${loadingKey}`} className="absolute inset-0 bg-background/70 backdrop-blur-md flex flex-col items-center justify-center z-50">
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
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
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
