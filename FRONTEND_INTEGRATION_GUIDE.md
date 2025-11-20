# 🚀 Frontend Integration Guide

## Socket.IO Connection Error Fix

The "Invalid namespace" error typically occurs due to:
1. Incorrect Socket.IO server URL
2. Missing or incorrect authentication 
3. CORS configuration issues
4. Wrong Socket.IO client version

## ✅ Correct Frontend Implementation

### 1. TypeScript Chat Service

```typescript
// services/ChatSocketService.ts
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  text: string;
  isAdmin: boolean;
  timestamp: string;
  senderName: string;
}

interface SocketResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class ChatSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Connect to Socket.IO server
   */
  connect(token: string, userType: 'user' | 'admin' = 'user'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Disconnect existing connection
        if (this.socket) {
          this.disconnect();
        }

        const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        console.log('🔗 Connecting to Socket.IO server:', serverUrl);

        this.socket = io(serverUrl, {
          auth: {
            token,
            userType
          },
          transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
          timeout: 20000, // 20 second timeout
          forceNew: true, // Force new connection
          autoConnect: false // Don't auto-connect, we'll connect manually
        });

        // Connection successful
        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connection_status', { connected: true });
          resolve(true);
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error);
          this.isConnected = false;
          this.emit('connection_status', { connected: false, error: error.message });
          
          // Auto-reconnect logic
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              this.socket?.connect();
            }, 2000 * this.reconnectAttempts); // Exponential backoff
          } else {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${error.message}`));
          }
        });

        // Disconnection
        this.socket.on('disconnect', (reason) => {
          console.log('🔌 Socket disconnected:', reason);
          this.isConnected = false;
          this.emit('connection_status', { connected: false, reason });
        });

        // Authentication error
        this.socket.on('error', (error) => {
          console.error('🚫 Socket authentication error:', error);
          this.isConnected = false;
          reject(new Error(`Authentication failed: ${error}`));
        });

        // Start connection
        this.socket.connect();

      } catch (error) {
        console.error('❌ Failed to initialize socket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Setup event listeners for Socket.IO events
   */
  private setupEventListeners() {
    // We'll add listeners when socket is connected
  }

  /**
   * Add event listeners after connection is established
   */
  private addSocketListeners() {
    if (!this.socket) return;

    // Chat events
    this.socket.on('new_message', (data) => {
      console.log('📨 New message received:', data);
      this.emit('new_message', data);
    });

    this.socket.on('agent_joined', (data) => {
      console.log('👨‍💼 Agent joined chat:', data);
      this.emit('agent_joined', data);
    });

    this.socket.on('chat_closed', (data) => {
      console.log('🔒 Chat closed:', data);
      this.emit('chat_closed', data);
    });

    this.socket.on('agent_typing', (data) => {
      this.emit('agent_typing', data);
    });

    this.socket.on('message_sent', (data) => {
      console.log('✅ Message sent confirmation:', data);
      this.emit('message_sent', data);
    });

    // Admin events (if admin)
    this.socket.on('new_chat_ticket', (data) => {
      console.log('🎫 New chat ticket:', data);
      this.emit('new_chat_ticket', data);
    });

    this.socket.on('user_message', (data) => {
      console.log('👤 User message:', data);
      this.emit('user_message', data);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 Socket disconnected manually');
    }
  }

  /**
   * Check if socket is connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Join chat room
   */
  joinChatRoom(ticketId: string) {
    if (this.isSocketConnected()) {
      console.log('🏠 Joining chat room:', ticketId);
      this.socket?.emit('join_chat_room', { ticketId });
    } else {
      console.error('❌ Cannot join chat room: Socket not connected');
    }
  }

  /**
   * Send chat message
   */
  sendMessage(ticketId: string, message: string, attachments: any[] = []) {
    if (this.isSocketConnected()) {
      console.log('📤 Sending message:', { ticketId, message });
      this.socket?.emit('send_message', { ticketId, message, attachments });
    } else {
      console.error('❌ Cannot send message: Socket not connected');
      throw new Error('Socket not connected');
    }
  }

  /**
   * Start typing indicator
   */
  startTyping(ticketId: string) {
    if (this.isSocketConnected()) {
      this.socket?.emit('user_typing', { ticketId, isTyping: true });
    }
  }

  /**
   * Stop typing indicator
   */
  stopTyping(ticketId: string) {
    if (this.isSocketConnected()) {
      this.socket?.emit('user_typing', { ticketId, isTyping: false });
    }
  }

  /**
   * Admin methods
   */
  joinAdminRoom() {
    if (this.isSocketConnected()) {
      this.socket?.emit('join_admin_room');
    }
  }

  joinChat(ticketId: string) {
    if (this.isSocketConnected()) {
      this.socket?.emit('join_chat', { ticketId });
    }
  }

  sendAdminMessage(ticketId: string, message: string, attachments: any[] = []) {
    if (this.isSocketConnected()) {
      this.socket?.emit('admin_send_message', { ticketId, message, attachments });
    }
  }

  closeChat(ticketId: string, resolutionSummary?: string) {
    if (this.isSocketConnected()) {
      this.socket?.emit('admin_close_chat', { ticketId, resolutionSummary });
    }
  }

  /**
   * Event management
   */
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}

// Export singleton instance
export const chatSocketService = new ChatSocketService();
export default chatSocketService;
```

### 2. Chat API Service (REST)

```typescript
// services/ChatApiService.ts
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

interface ChatTicket {
  _id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  messages: ChatMessage[];
  assignedTo?: {
    fullName: string;
    email: string;
  };
  createdAt: string;
  lastUpdated: string;
}

interface ChatMessage {
  _id: string;
  sender: string;
  senderModel: string;
  message: string;
  isAdminReply: boolean;
  timestamp: string;
  attachments?: any[];
}

class ChatApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/chat${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Start a new chat session
   */
  async startChat(message: string, category?: string, priority?: string): Promise<ApiResponse<ChatTicket>> {
    return this.request('/start', {
      method: 'POST',
      body: JSON.stringify({ message, category, priority }),
    });
  }

  /**
   * Get chat history
   */
  async getChatHistory(page: number = 1, limit: number = 10): Promise<ApiResponse<{
    chats: ChatTicket[];
    pagination: any;
  }>> {
    return this.request(`/history?page=${page}&limit=${limit}`);
  }

  /**
   * Get specific chat ticket
   */
  async getChatTicket(ticketId: string): Promise<ApiResponse<{ ticket: ChatTicket }>> {
    return this.request(`/${ticketId}`);
  }

  /**
   * Send message via REST (fallback)
   */
  async sendMessage(ticketId: string, message: string, attachments?: any[]): Promise<ApiResponse> {
    return this.request(`/${ticketId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, attachments }),
    });
  }

  /**
   * Admin methods
   */
  async getActiveChats(status?: string): Promise<ApiResponse<{
    chats: ChatTicket[];
    count: number;
  }>> {
    const query = status ? `?status=${status}` : '';
    return this.request(`/admin/active${query}`);
  }

  async joinChatAsAdmin(ticketId: string): Promise<ApiResponse> {
    return this.request(`/admin/join/${ticketId}`, {
      method: 'POST',
    });
  }

  async closeChatAsAdmin(ticketId: string, resolutionSummary?: string): Promise<ApiResponse> {
    return this.request(`/admin/close/${ticketId}`, {
      method: 'POST',
      body: JSON.stringify({ resolutionSummary }),
    });
  }
}

export const chatApiService = new ChatApiService();
export default chatApiService;
```

### 3. React Chat Component

```tsx
// components/FloatingChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import chatSocketService from '../services/ChatSocketService';
import chatApiService from '../services/ChatApiService';

interface ChatMessage {
  id: string;
  text: string;
  isAdmin: boolean;
  timestamp: string;
  senderName: string;
  isSystem?: boolean;
}

interface FloatingChatProps {
  token: string;
  userType?: 'user' | 'admin';
}

const FloatingChat: React.FC<FloatingChatProps> = ({ token, userType = 'user' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      initializeChat();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Set API token
      chatApiService.setToken(token);

      // Connect to Socket.IO
      await chatSocketService.connect(token, userType);
      setIsConnected(true);

      // Setup event listeners
      chatSocketService.on('connection_status', handleConnectionStatus);
      chatSocketService.on('new_message', handleNewMessage);
      chatSocketService.on('agent_joined', handleAgentJoined);
      chatSocketService.on('chat_closed', handleChatClosed);
      chatSocketService.on('agent_typing', handleAgentTyping);

    } catch (error) {
      console.error('❌ Failed to initialize chat:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectionStatus = (data: any) => {
    setIsConnected(data.connected);
    if (!data.connected) {
      setConnectionError(data.error || data.reason || 'Disconnected');
    } else {
      setConnectionError(null);
    }
  };

  const handleNewMessage = (data: any) => {
    const message: ChatMessage = {
      id: data.messageId || Date.now().toString(),
      text: data.message,
      isAdmin: data.isAdminReply,
      timestamp: data.timestamp,
      senderName: data.senderName || (data.isAdminReply ? 'Support Agent' : 'You')
    };
    setMessages(prev => [...prev, message]);
    setIsTyping(false);
  };

  const handleAgentJoined = (data: any) => {
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      text: `${data.agentName} joined the chat`,
      isAdmin: false,
      timestamp: data.joinedAt,
      senderName: 'System',
      isSystem: true
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleChatClosed = (data: any) => {
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      text: `Chat session closed by ${data.closedBy}`,
      isAdmin: false,
      timestamp: data.closedAt,
      senderName: 'System',
      isSystem: true
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleAgentTyping = (data: any) => {
    setIsTyping(data.isTyping);
    if (data.isTyping && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startChat = async () => {
    try {
      setIsSending(true);
      const response = await chatApiService.startChat(newMessage);
      
      if (response.success) {
        setTicketId(response.data.ticketId);
        setMessages(response.data.messages.map((msg: any) => ({
          id: msg._id,
          text: msg.message,
          isAdmin: msg.isAdminReply,
          timestamp: msg.timestamp,
          senderName: msg.isAdminReply ? 'Support Agent' : 'You'
        })));
        
        // Join chat room via Socket.IO
        chatSocketService.joinChatRoom(response.data.ticketId);
        setNewMessage('');
      }
    } catch (error) {
      console.error('❌ Failed to start chat:', error);
      setConnectionError('Failed to start chat. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !ticketId || isSending) return;

    try {
      setIsSending(true);
      
      // Add message optimistically
      const tempMessage: ChatMessage = {
        id: Date.now().toString(),
        text: newMessage,
        isAdmin: false,
        timestamp: new Date().toISOString(),
        senderName: 'You'
      };
      setMessages(prev => [...prev, tempMessage]);
      
      // Send via Socket.IO (real-time)
      chatSocketService.sendMessage(ticketId, newMessage);
      setNewMessage('');
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.slice(0, -1));
      setConnectionError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (ticketId) {
        sendMessage();
      } else {
        startChat();
      }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-colors"
        >
          💬 Chat Support
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-2xl w-80 h-96 flex flex-col border">
          {/* Header */}
          <div className="bg-blue-500 text-white p-4 rounded-t-lg flex justify-between items-center">
            <h3 className="font-semibold">Support Chat</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Connection Status */}
          {connectionError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3">
              <p className="text-sm text-red-800">{connectionError}</p>
              <button 
                onClick={initializeChat}
                className="text-xs text-red-600 underline mt-1"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Loading State */}
          {isConnecting && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Connecting...</p>
              </div>
            </div>
          )}

          {/* Messages */}
          {!isConnecting && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm">
                  Start a conversation with our support team
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isAdmin ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      message.isSystem
                        ? 'bg-gray-100 text-gray-600 text-center w-full'
                        : message.isAdmin
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    <div>{message.text}</div>
                    <div className={`text-xs mt-1 ${
                      message.isSystem || message.isAdmin ? 'text-gray-500' : 'text-blue-100'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          {!isConnecting && (
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={ticketId ? "Type your message..." : "Start a chat..."}
                  disabled={!isConnected || isSending}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <button
                  onClick={ticketId ? sendMessage : startChat}
                  disabled={!newMessage.trim() || !isConnected || isSending}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSending ? '...' : ticketId ? 'Send' : 'Start'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FloatingChat;
```

### 4. Environment Variables

```env
# .env (Frontend)
VITE_API_URL=http://localhost:5000
VITE_WS_URL=http://localhost:5000
```

### 5. Usage in Your App

```tsx
// App.tsx or your main component
import FloatingChat from './components/FloatingChat';

function App() {
  const token = localStorage.getItem('token'); // Your JWT token

  return (
    <div className="App">
      {/* Your app content */}
      
      {/* Add floating chat */}
      {token && <FloatingChat token={token} userType="user" />}
    </div>
  );
}
```

## 🔧 Troubleshooting

1. **Install Dependencies**:
```bash
npm install socket.io-client
```

2. **Check Backend Server**:
- Make sure server is running on `http://localhost:5000`
- Verify Socket.IO is properly initialized
- Check CORS settings

3. **Authentication**:
- Ensure JWT token is valid
- Check token format in localStorage

4. **Network Issues**:
- Try changing `transports: ['polling']` if WebSocket fails
- Check firewall/proxy settings

The key fixes in this implementation:
- Proper error handling and reconnection logic
- Correct Socket.IO client configuration
- Authentication handling
- Fallback transport mechanisms
- TypeScript interfaces for type safety

Try this implementation and let me know if you encounter any issues!
