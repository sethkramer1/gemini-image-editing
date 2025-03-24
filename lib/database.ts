import { supabase, Conversation, Message, Image } from './supabase';
import { HistoryItem, HistoryPart } from './types';
import { v4 as uuidv4 } from 'uuid';

// Helper function to test Supabase connection
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  error?: string;
  buckets?: string[];
  details?: any;
}> {
  try {
    // Log connection attempt
    console.log('Testing Supabase connection...');
    
    // Test authentication
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('Auth error details:', authError);
      return { 
        success: false, 
        error: `Auth error: ${authError.message}`,
        details: { auth: authError }
      };
    }
    
    console.log('Auth check passed');
    
    // Test storage buckets
    const { data: bucketsData, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('Buckets error details:', bucketsError);
      return { 
        success: false, 
        error: `Storage error: ${bucketsError.message}`,
        details: { buckets: bucketsError }
      };
    }
    
    console.log('Available buckets:', bucketsData?.map(b => b.name).join(', ') || 'None');
    
    // Check if images bucket exists
    const imagesBucketExists = bucketsData?.some(bucket => bucket.name === 'images');
    if (!imagesBucketExists) {
      return {
        success: false,
        error: 'Images bucket does not exist',
        buckets: bucketsData?.map(b => b.name),
        details: { availableBuckets: bucketsData }
      };
    }
    
    // Try to list files in the images bucket as a further test
    const { data: files, error: filesError } = await supabase.storage
      .from('images')
      .list();
      
    if (filesError) {
      return {
        success: false,
        error: `Could connect to images bucket but failed to list files: ${filesError.message}`,
        buckets: bucketsData?.map(b => b.name),
        details: { filesError }
      };
    }
    
    return {
      success: true,
      buckets: bucketsData?.map(b => b.name),
      details: { 
        filesCount: files?.length || 0,
        authSession: !!authData?.session
      }
    };
  } catch (error) {
    console.error('Unexpected error in connection test:', error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    };
  }
}

// Helper to convert from Supabase timestamp to Date object
const parseTimestamp = (timestamp: string): Date => new Date(timestamp);

// Helper to create storage path for images
const createImagePath = (userId: string = 'anonymous'): string => {
  return `${userId}/${uuidv4()}`;
};

// Conversations
export async function getConversations(userId?: string): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });
  
  // Filter by user_id if provided
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
  
  return data || [];
}

export async function getConversation(id: string, userId?: string): Promise<Conversation | null> {
  let query = supabase
    .from('conversations')
    .select('*')
    .eq('id', id);
  
  // Filter by user_id if provided
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query.single();
  
  if (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
  
  return data;
}

export async function createConversation(title: string, userId?: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversations')
    .insert([{ 
      title,
      user_id: userId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select();
  
  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }
  
  return data?.[0]?.id || null;
}

export async function updateConversationTimestamp(id: string, userId?: string): Promise<boolean> {
  let query = supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() });
  
  // Add user_id filter if provided
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { error } = await query.eq('id', id);
  
  if (error) {
    console.error('Error updating conversation timestamp:', error);
    return false;
  }
  
  return true;
}

export async function deleteConversation(id: string, userId?: string): Promise<boolean> {
  // First get the conversation to verify ownership
  let query = supabase.from('conversations').select('id');
  
  // Add user_id filter if provided
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data: conversation } = await query.eq('id', id).single();
  
  // If no conversation found or user doesn't own it, return false
  if (!conversation) {
    console.error('Conversation not found or unauthorized');
    return false;
  }
  
  // First, get all messages to find associated images
  const { data: messages } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', id);
  
  if (messages && messages.length > 0) {
    const messageIds = messages.map(msg => msg.id);
    
    // Delete associated images from storage
    const { data: images } = await supabase
      .from('images')
      .select('storage_path, original_path')
      .in('message_id', messageIds);
    
    if (images && images.length > 0) {
      // Delete the image files from storage
      for (const image of images) {
        if (image.storage_path) {
          await supabase.storage.from('images').remove([image.storage_path]);
        }
        if (image.original_path) {
          await supabase.storage.from('images').remove([image.original_path]);
        }
      }
      
      // Delete image records
      await supabase
        .from('images')
        .delete()
        .in('message_id', messageIds);
    }
    
    // Delete message records
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id);
  }
  
  // Finally delete the conversation
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }
  
  return true;
}

// Messages
export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  
  return data || [];
}

export async function createMessage(
  conversationId: string, 
  role: 'user' | 'model', 
  content: string,
  hasImage: boolean
): Promise<string | null> {
  console.log(`Creating ${role} message for conversation ${conversationId}`, {
    content: content ? content.substring(0, 30) + '...' : 'empty',
    hasImage
  });

  const { data, error } = await supabase
    .from('messages')
    .insert([{ 
      conversation_id: conversationId,
      role,
      content,
      has_image: hasImage,
      created_at: new Date().toISOString()
    }])
    .select();
  
  if (error) {
    console.error('Error creating message:', error);
    return null;
  }
  
  // Update the conversation's updated_at timestamp
  await updateConversationTimestamp(conversationId);
  
  return data?.[0]?.id || null;
}

// Images
export async function uploadImage(
  messageId: string, 
  imageData: string,
  isOriginal: boolean = false
): Promise<string | null> {
  try {
    console.log('Starting uploadImage function');
    
    // Validate image data format
    if (!imageData) {
      console.error('Image data is empty or undefined');
      return null;
    }
    
    let base64Data;
    let contentType = 'image/png';
    
    // Check if it's already a data URL
    if (imageData.startsWith('data:')) {
      const parts = imageData.split(',');
      if (parts.length < 2) {
        console.error('Invalid data URL format');
        return null;
      }
      
      // Extract MIME type
      const mimeMatch = parts[0].match(/data:(.*?);base64/);
      if (mimeMatch && mimeMatch[1]) {
        contentType = mimeMatch[1];
      }
      
      base64Data = parts[1];
    } else {
      // Assume it's already base64 without data URL prefix
      base64Data = imageData;
    }
    
    if (!base64Data) {
      console.error('Failed to extract base64 data from image');
      return null;
    }
    
    let blob;
    try {
      blob = Buffer.from(base64Data, 'base64');
      console.log('Created blob from base64, size:', blob.length);
    } catch (error) {
      console.error('Error creating blob from base64:', error);
      return null;
    }
    
    if (!blob || blob.length === 0) {
      console.error('Blob is empty or invalid');
      return null;
    }
    
    // Create a unique path with timestamp for uniqueness
    const path = `${new Date().getTime()}-${uuidv4()}`;
    
    console.log('Uploading image to path:', path);
    console.log('Content type:', contentType);
    
    try {
      // Upload to Supabase Storage with explicit content type
      const { data, error } = await supabase.storage
        .from('images')
        .upload(path, blob, {
          contentType: contentType,
          cacheControl: '3600'
        });
      
      if (error) {
        console.error('Storage upload error:', JSON.stringify(error));
        return null;
      }
      
      console.log('Upload successful, data:', data);
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(path);
      
      if (!urlData || !urlData.publicUrl) {
        console.error('Failed to get public URL');
        return null;
      }
      
      const publicUrl = urlData.publicUrl;
      console.log('Image public URL:', publicUrl);
      
      // Save the reference in the database
      const { error: dbError } = await supabase
        .from('images')
        .insert([{
          message_id: messageId,
          storage_path: path,
          ...(isOriginal ? { original_path: path } : {}),
          created_at: new Date().toISOString()
        }]);
      
      if (dbError) {
        console.error('Error saving image reference:', JSON.stringify(dbError));
        
        // Try to clean up
        await supabase.storage.from('images').remove([path]);
        return null;
      }
      
      return publicUrl;
    } catch (uploadError) {
      console.error('Error during upload process:', uploadError);
      return null;
    }
  } catch (error) {
    console.error('Unexpected error in uploadImage:', error);
    return null;
  }
}

// Conversion utilities for the app's existing data structure
export async function convertAndSaveHistory(
  conversationHistory: HistoryItem[],
  title?: string,
  existingConversationId?: string,
  userId?: string
): Promise<string | null> {
  try {
    console.log('Starting convertAndSaveHistory');
    
    // Debug image data format
    for (const item of conversationHistory) {
      for (const part of item.parts) {
        if (part.image) {
          const imageStr = part.image;
          console.log('Image data type:', typeof imageStr);
          console.log('Image data starts with:', imageStr.substring(0, 30));
          console.log('Image data length:', imageStr.length);
          const hasMimeType = imageStr.includes('data:image/');
          console.log('Has MIME type prefix:', hasMimeType);
        }
      }
    }
    
    // Get or create conversation
    let conversationId = existingConversationId;
    
    if (!conversationId) {
      // Create new conversation
      const defaultTitle = title || 'New Conversation';
      conversationId = await createConversation(defaultTitle, userId);
      
      if (!conversationId) {
        throw new Error('Failed to create conversation');
      }
    } else {
      // Make sure the conversation exists and belongs to the user
      const conversation = await getConversation(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }
    }

    // Extract title from the first user message if not provided
    if (!title) {
      const firstUserMsg = conversationHistory.find(item => item.role === 'user');
      const firstUserText = firstUserMsg?.parts.find(part => part.text)?.text;
      title = firstUserText ? firstUserText.substring(0, 30) : 'New Conversation';
    }
    
    // First, delete all existing messages for this conversation
    const { data: messages } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId);
    
    if (messages && messages.length > 0) {
      const messageIds = messages.map(msg => msg.id);
      
      // Delete associated images
      const { data: images } = await supabase
        .from('images')
        .select('storage_path')
        .in('message_id', messageIds);
      
      if (images && images.length > 0) {
        // Delete image records
        await supabase
          .from('images')
          .delete()
          .in('message_id', messageIds);
      }
      
      // Delete message records
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
    }
    
    // Update the conversation's timestamp
    await updateConversationTimestamp(conversationId);

    // Add all messages
    for (const item of conversationHistory) {
      const hasImage = item.parts.some(part => part.image);
      const textContent = item.parts
        .filter(part => part.text)
        .map(part => part.text)
        .join(' ');
      
      console.log(`Saving ${item.role} message with text: "${textContent?.substring(0, 30) || 'none'}", hasImage: ${hasImage}`);
      
      const messageId = await createMessage(
        conversationId,
        item.role as 'user' | 'model',
        textContent || '',
        hasImage
      );
      
      if (messageId && hasImage) {
        // Upload any images
        for (const part of item.parts) {
          if (part.image) {
            // Check if this is an original image (usually in the first user message)
            const isOriginal = item.role === 'user' && 
              conversationHistory.indexOf(item) <= 1;
            
            console.log(`Uploading image for ${item.role} message, isOriginal: ${isOriginal}`);
            await uploadImage(messageId, part.image, isOriginal);
          }
        }
      }
    }
    
    return conversationId;
  } catch (error) {
    console.error('Error converting and saving history:', error);
    return null;
  }
}

export async function loadConversationAsHistory(
  conversationId: string,
  userId?: string
): Promise<HistoryItem[]> {
  console.log(`Loading conversation history for ID: ${conversationId}`);
  const history: HistoryItem[] = [];
  
  // Get conversation to verify ownership
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    console.error('Conversation not found or unauthorized');
    return [];
  }
  
  // Get all messages for this conversation
  const messages = await getMessages(conversationId);
  console.log(`Found ${messages.length} messages for conversation`);
  
  for (const message of messages) {
    const historyItem: HistoryItem = {
      role: message.role,
      parts: []
    };
    
    // Add text part if there's content
    if (message.content) {
      console.log(`Adding ${message.role} text: ${message.content.substring(0, 30)}...`);
      historyItem.parts.push({
        text: message.content
      });
    }
    
    // Add image part if has_image is true
    if (message.has_image) {
      const { data: images } = await supabase
        .from('images')
        .select('storage_path')
        .eq('message_id', message.id);
      
      console.log(`Found ${images?.length || 0} images for message ID: ${message.id}`);
      
      if (images && images.length > 0) {
        for (const image of images) {
          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(image.storage_path);
          
          if (publicUrl) {
            console.log(`Adding ${message.role} image URL: ${publicUrl.substring(0, 50)}...`);
            // Mark this as an imageUrl rather than a base64 image
            // This will be processed differently when sending to the API
            historyItem.parts.push({
              image: publicUrl,
              isImageUrl: true // Add this flag to indicate it's a URL, not base64
            });
          }
        }
      }
    }
    
    history.push(historyItem);
  }
  
  console.log(`Returning ${history.length} history items with roles: ${history.map(h => h.role).join(', ')}`);
  return history;
} 