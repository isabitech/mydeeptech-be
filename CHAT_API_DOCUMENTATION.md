# 💬 Chat Support System API Documentation

## Overview
The Chat Support System provides real-time communication between users and support agents through WebSocket (Socket.IO) and REST API endpoints. Each chat session automatically creates a support ticket for tracking and management.

## 🔗 Base URLs
- **REST API**: `https://api.mydeeptech.ng/api/chat`
- **WebSocket**: `wss://api.mydeeptech.ng` or `https://api.mydeeptech.ng`

## 🔐 Authentication
All endpoints require authentication via JWT token:
```javascript
// Headers for REST API
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}

// WebSocket Authentication
socket.auth = {
  token: "<jwt_token>"
};
```

---

# 👤 USER ENDPOINTS

## 1. Start Chat Session
**Endpoint**: `POST /api/chat/start`

Creates a new chat session and support ticket automatically.

### Request Body
```json
{
  "message": "Hello, I need help with my account",
  "category": "account_support", // optional
  "priority": "medium" // optional: low, medium, high
}
```

### Response
```json
{
  "success": true,
  "message": "Chat session started successfully",
  "data": {
    "ticketId": "674d8f9e1234567890abcdef",
    "ticketNumber": "TKT-2024-001234",
    "status": "open",
    "messages": [
      {
        "sender": "674d8f9e1234567890abcdff",
        "senderModel": "DTUser",
        "message": "Hello, I need help with my account",
        "isAdminReply": false,
        "timestamp": "2024-12-02T10:30:00.000Z",
        "_id": "674d8f9e1234567890abcde0"
      }
    ],
    "isExisting": false
  }
}
```

### Error Responses
```json
// Missing message
{
  "success": false,
  "message": "Initial message is required to start chat"
}

// User already has active chat
{
  "success": true,
  "message": "Chat session already exists",
  "data": {
    "ticketId": "...",
    "isExisting": true
  }
}
```

## 2. Get Chat History
**Endpoint**: `GET /api/chat/history`

Retrieves user's chat history with pagination.

### Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### Request
```
GET /api/chat/history?page=1&limit=10
```

### Response
```json
{
  "success": true,
  "message": "Chat history retrieved successfully",
  "data": {
    "chats": [
      {
        "_id": "674d8f9e1234567890abcdef",
        "ticketNumber": "TKT-2024-001234",
        "subject": "Chat Support - 12/2/2024",
        "status": "resolved",
        "priority": "medium",
        "category": "account_support",
        "createdAt": "2024-12-02T10:30:00.000Z",
        "lastUpdated": "2024-12-02T11:45:00.000Z",
        "messages": [...],
        "assignedTo": {
          "fullName": "John Admin",
          "email": "john@mydeeptech.ng"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalChats": 25,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 10
    }
  }
}
```

## 3. Get Specific Chat
**Endpoint**: `GET /api/chat/:ticketId`

Retrieves details of a specific chat session.

### Request
```
GET /api/chat/674d8f9e1234567890abcdef
```

### Response
```json
{
  "success": true,
  "message": "Chat ticket retrieved successfully",
  "data": {
    "ticket": {
      "_id": "674d8f9e1234567890abcdef",
      "ticketNumber": "TKT-2024-001234",
      "subject": "Chat Support - 12/2/2024",
      "status": "in_progress",
      "priority": "medium",
      "category": "account_support",
      "isChat": true,
      "messages": [
        {
          "sender": "674d8f9e1234567890abcdff",
          "senderModel": "DTUser",
          "message": "Hello, I need help with my account",
          "isAdminReply": false,
          "timestamp": "2024-12-02T10:30:00.000Z"
        },
        {
          "sender": "674d8f9e1234567890abcde1",
          "senderModel": "Admin",
          "message": "Hello! I'm here to help. What specific issue are you having?",
          "isAdminReply": true,
          "timestamp": "2024-12-02T10:32:00.000Z"
        }
      ],
      "assignedTo": {
        "fullName": "John Admin",
        "email": "john@mydeeptech.ng"
      }
    }
  }
}
```

## 4. Send Chat Message (REST Fallback)
**Endpoint**: `POST /api/chat/:ticketId/message`

Send a message via REST API (use WebSocket for real-time).

### Request Body
```json
{
  "message": "Thank you for your help!",
  "attachments": [] // optional
}
```

### Response
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "674d8f9e1234567890abcde2",
    "timestamp": "2024-12-02T10:45:00.000Z",
    "ticketStatus": "in_progress"
  }
}
```

---

# 👨‍💼 ADMIN ENDPOINTS

## 1. Get Active Chat Tickets
**Endpoint**: `GET /api/chat/admin/active`

Retrieves all active chat sessions for admin dashboard.

### Query Parameters
- `status`: Filter by status (default: "active" for open/in_progress/waiting_for_user)

### Request
```
GET /api/chat/admin/active?status=active
```

### Response
```json
{
  "success": true,
  "message": "Active chat tickets retrieved successfully",
  "data": {
    "chats": [
      {
        "_id": "674d8f9e1234567890abcdef",
        "ticketNumber": "TKT-2024-001234",
        "subject": "Chat Support - 12/2/2024",
        "status": "open",
        "priority": "high",
        "category": "technical_support",
        "createdAt": "2024-12-02T10:30:00.000Z",
        "lastUpdated": "2024-12-02T10:30:00.000Z",
        "userId": {
          "fullName": "Jane Doe",
          "email": "jane@example.com"
        },
        "assignedTo": null,
        "messages": [...]
      }
    ],
    "count": 5
  }
}
```

## 2. Join Chat as Admin
**Endpoint**: `POST /api/chat/admin/join/:ticketId`

Assigns the chat ticket to the admin and updates status.

### Request
```
POST /api/chat/admin/join/674d8f9e1234567890abcdef
```

### Response
```json
{
  "success": true,
  "message": "Successfully joined chat as admin",
  "data": {
    "ticketId": "674d8f9e1234567890abcdef",
    "ticketNumber": "TKT-2024-001234",
    "assignedTo": "674d8f9e1234567890abcde1",
    "status": "in_progress",
    "userName": "Jane Doe",
    "userEmail": "jane@example.com",
    "messages": [...]
  }
}
```

## 3. Close Chat Session
**Endpoint**: `POST /api/chat/admin/close/:ticketId`

Closes the chat session and resolves the ticket.

### Request Body
```json
{
  "resolutionSummary": "Account issue resolved successfully" // optional
}
```

### Response
```json
{
  "success": true,
  "message": "Chat session closed successfully",
  "data": {
    "ticketId": "674d8f9e1234567890abcdef",
    "ticketNumber": "TKT-2024-001234",
    "resolvedAt": "2024-12-02T11:45:00.000Z",
    "resolutionSummary": "Account issue resolved successfully"
  }
}
```

---

# 🔌 WebSocket (Socket.IO) Events

## Connection Setup

### Frontend Implementation
```javascript
import io from 'socket.io-client';

// User Connection
const socket = io('https://api.mydeeptech.ng', {
  auth: {
    token: localStorage.getItem('token'),
    userType: 'user' // or 'admin'
  }
});

// Admin Connection
const adminSocket = io('https://api.mydeeptech.ng', {
  auth: {
    token: localStorage.getItem('adminToken'),
    userType: 'admin'
  }
});
```

## User Events

### 📤 Emit Events (User → Server)

#### 1. Join Chat Room
```javascript
socket.emit('join_chat_room', {
  ticketId: '674d8f9e1234567890abcdef'
});
```

#### 2. Send Message
```javascript
socket.emit('send_message', {
  ticketId: '674d8f9e1234567890abcdef',
  message: 'Hello, I need assistance',
  attachments: [] // optional
});
```

#### 3. Start Typing
```javascript
socket.emit('user_typing', {
  ticketId: '674d8f9e1234567890abcdef',
  isTyping: true
});
```

### 📥 Listen Events (Server → User)

#### 1. Connection Status
```javascript
socket.on('connect', () => {
  console.log('Connected to chat server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from chat server');
});
```

#### 2. Message Events
```javascript
// New message received
socket.on('new_message', (data) => {
  console.log('New message:', data);
  /*
  {
    messageId: "674d8f9e1234567890abcde2",
    ticketId: "674d8f9e1234567890abcdef",
    sender: "674d8f9e1234567890abcde1",
    senderName: "John Admin",
    message: "Hello! How can I help you?",
    isAdminReply: true,
    timestamp: "2024-12-02T10:32:00.000Z"
  }
  */
});

// Message status update
socket.on('message_sent', (data) => {
  console.log('Message sent successfully:', data);
  /*
  {
    messageId: "674d8f9e1234567890abcde2",
    timestamp: "2024-12-02T10:45:00.000Z",
    status: "sent"
  }
  */
});
```

#### 3. Chat Status Events
```javascript
// Agent joined chat
socket.on('agent_joined', (data) => {
  console.log('Support agent joined:', data);
  /*
  {
    ticketId: "674d8f9e1234567890abcdef",
    agentName: "John Admin",
    agentId: "674d8f9e1234567890abcde1",
    joinedAt: "2024-12-02T10:32:00.000Z"
  }
  */
});

// Chat closed
socket.on('chat_closed', (data) => {
  console.log('Chat session closed:', data);
  /*
  {
    ticketId: "674d8f9e1234567890abcdef",
    closedBy: "John Admin",
    closedAt: "2024-12-02T11:45:00.000Z",
    resolutionSummary: "Issue resolved"
  }
  */
});

// Agent typing indicator
socket.on('agent_typing', (data) => {
  console.log('Agent is typing:', data);
  /*
  {
    ticketId: "674d8f9e1234567890abcdef",
    agentName: "John Admin",
    isTyping: true
  }
  */
});
```

## Admin Events

### 📤 Emit Events (Admin → Server)

#### 1. Join Admin Room
```javascript
adminSocket.emit('join_admin_room');
```

#### 2. Join Specific Chat
```javascript
adminSocket.emit('join_chat', {
  ticketId: '674d8f9e1234567890abcdef'
});
```

#### 3. Send Admin Message
```javascript
adminSocket.emit('admin_send_message', {
  ticketId: '674d8f9e1234567890abcdef',
  message: 'I understand your concern. Let me help you with that.',
  attachments: []
});
```

#### 4. Close Chat
```javascript
adminSocket.emit('admin_close_chat', {
  ticketId: '674d8f9e1234567890abcdef',
  resolutionSummary: 'Account issue resolved successfully'
});
```

### 📥 Listen Events (Server → Admin)

#### 1. New Chat Notifications
```javascript
// New chat ticket created
adminSocket.on('new_chat_ticket', (data) => {
  console.log('New chat ticket:', data);
  /*
  {
    ticketId: "674d8f9e1234567890abcdef",
    ticketNumber: "TKT-2024-001234",
    userName: "Jane Doe",
    userEmail: "jane@example.com",
    message: "I need help with my account",
    priority: "medium",
    category: "account_support",
    createdAt: "2024-12-02T10:30:00.000Z"
  }
  */
});

// User sent new message
adminSocket.on('user_message', (data) => {
  console.log('User message received:', data);
  /*
  {
    ticketId: "674d8f9e1234567890abcdef",
    ticketNumber: "TKT-2024-001234",
    userName: "Jane Doe",
    userEmail: "jane@example.com",
    message: "Thank you for your help!",
    timestamp: "2024-12-02T10:45:00.000Z"
  }
  */
});
```

#### 2. Admin Management Events
```javascript
// Admin status update
adminSocket.on('admin_status_update', (data) => {
  console.log('Admin status:', data);
  /*
  {
    adminId: "674d8f9e1234567890abcde1",
    isOnline: true,
    activeChats: 3
  }
  */
});

// Chat assignment
adminSocket.on('chat_assigned', (data) => {
  console.log('Chat assigned:', data);
  /*
  {
    ticketId: "674d8f9e1234567890abcdef",
    assignedTo: "674d8f9e1234567890abcde1",
    assignedAt: "2024-12-02T10:32:00.000Z"
  }
  */
});
```

---

# 🎨 Frontend Implementation Examples

## React Chat Component (User)

```jsx
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const ChatInterface = ({ token }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ticketId, setTicketId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('https://api.mydeeptech.ng', {
      auth: { token, userType: 'user' }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to chat server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from chat server');
    });

    newSocket.on('new_message', (data) => {
      setMessages(prev => [...prev, {
        id: data.messageId,
        text: data.message,
        isAdmin: data.isAdminReply,
        timestamp: data.timestamp,
        senderName: data.senderName
      }]);
      scrollToBottom();
    });

    newSocket.on('agent_joined', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${data.agentName} joined the chat`,
        isSystem: true,
        timestamp: data.joinedAt
      }]);
    });

    newSocket.on('agent_typing', (data) => {
      setAgentTyping(data.isTyping);
      if (data.isTyping) {
        setTimeout(() => setAgentTyping(false), 3000);
      }
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startChat = async () => {
    try {
      const response = await fetch('https://api.mydeeptech.ng/api/chat/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: newMessage,
          category: 'general_inquiry',
          priority: 'medium'
        })
      });

      const data = await response.json();
      if (data.success) {
        setTicketId(data.data.ticketId);
        setMessages(data.data.messages.map(msg => ({
          id: msg._id,
          text: msg.message,
          isAdmin: msg.isAdminReply,
          timestamp: msg.timestamp,
          senderName: msg.isAdminReply ? 'Support Agent' : 'You'
        })));
        
        // Join chat room
        socket.emit('join_chat_room', { ticketId: data.data.ticketId });
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim() && socket && ticketId) {
      socket.emit('send_message', {
        ticketId,
        message: newMessage
      });
      
      // Add message optimistically
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: newMessage,
        isAdmin: false,
        timestamp: new Date().toISOString(),
        senderName: 'You'
      }]);
      
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
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
    <div className="chat-container">
      <div className="chat-header">
        <h3>Support Chat</h3>
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.isAdmin ? 'admin' : 'user'} ${message.isSystem ? 'system' : ''}`}
          >
            <div className="message-content">
              <div className="message-text">{message.text}</div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {agentTyping && (
          <div className="typing-indicator">
            <div className="typing-text">Support agent is typing...</div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={ticketId ? "Type your message..." : "Start a chat..."}
          disabled={!isConnected}
        />
        <button 
          onClick={ticketId ? sendMessage : startChat}
          disabled={!newMessage.trim() || !isConnected}
        >
          {ticketId ? 'Send' : 'Start Chat'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
```

## React Admin Dashboard Component

```jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const AdminChatDashboard = ({ adminToken }) => {
  const [socket, setSocket] = useState(null);
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // Initialize admin socket
    const adminSocket = io('https://api.mydeeptech.ng', {
      auth: { token: adminToken, userType: 'admin' }
    });

    adminSocket.on('connect', () => {
      adminSocket.emit('join_admin_room');
      loadActiveChats();
    });

    adminSocket.on('new_chat_ticket', (data) => {
      setActiveChats(prev => [data, ...prev]);
      // Show notification
      showNotification(`New chat from ${data.userName}`, data.message);
    });

    adminSocket.on('user_message', (data) => {
      if (selectedChat?.ticketId === data.ticketId) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: data.message,
          isAdmin: false,
          timestamp: data.timestamp,
          senderName: data.userName
        }]);
      }
      // Update chat list
      updateChatInList(data.ticketId, data.message);
    });

    setSocket(adminSocket);
    return () => adminSocket.close();
  }, [adminToken]);

  const loadActiveChats = async () => {
    try {
      const response = await fetch('https://api.mydeeptech.ng/api/chat/admin/active', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setActiveChats(data.data.chats);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const joinChat = async (chat) => {
    try {
      const response = await fetch(`https://api.mydeeptech.ng/api/chat/admin/join/${chat._id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setSelectedChat(data.data);
        setMessages(data.data.messages.map(msg => ({
          id: msg._id,
          text: msg.message,
          isAdmin: msg.isAdminReply,
          timestamp: msg.timestamp,
          senderName: msg.isAdminReply ? 'You' : data.data.userName
        })));
        
        socket.emit('join_chat', { ticketId: chat._id });
      }
    } catch (error) {
      console.error('Error joining chat:', error);
    }
  };

  const sendAdminMessage = () => {
    if (newMessage.trim() && socket && selectedChat) {
      socket.emit('admin_send_message', {
        ticketId: selectedChat.ticketId,
        message: newMessage
      });
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: newMessage,
        isAdmin: true,
        timestamp: new Date().toISOString(),
        senderName: 'You'
      }]);
      
      setNewMessage('');
    }
  };

  const closeChat = async () => {
    if (selectedChat) {
      try {
        const response = await fetch(`https://api.mydeeptech.ng/api/chat/admin/close/${selectedChat.ticketId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            resolutionSummary: 'Chat session completed successfully'
          })
        });
        
        if (response.ok) {
          setSelectedChat(null);
          setMessages([]);
          loadActiveChats(); // Refresh chat list
        }
      } catch (error) {
        console.error('Error closing chat:', error);
      }
    }
  };

  return (
    <div className="admin-chat-dashboard">
      <div className="chat-list">
        <h3>Active Chats ({activeChats.length})</h3>
        {activeChats.map((chat) => (
          <div
            key={chat._id}
            className={`chat-item ${selectedChat?.ticketId === chat._id ? 'selected' : ''}`}
            onClick={() => joinChat(chat)}
          >
            <div className="chat-info">
              <div className="user-name">{chat.userId.fullName}</div>
              <div className="ticket-number">{chat.ticketNumber}</div>
              <div className={`priority priority-${chat.priority}`}>
                {chat.priority.toUpperCase()}
              </div>
            </div>
            <div className="chat-preview">
              {chat.messages[chat.messages.length - 1]?.message}
            </div>
            <div className="chat-time">
              {new Date(chat.lastUpdated).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-interface">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <div className="user-info">
                <h4>{selectedChat.userName}</h4>
                <span>{selectedChat.userEmail}</span>
                <span className="ticket-number">{selectedChat.ticketNumber}</span>
              </div>
              <button onClick={closeChat} className="close-chat-btn">
                Close Chat
              </button>
            </div>

            <div className="chat-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.isAdmin ? 'admin' : 'user'}`}
                >
                  <div className="message-content">
                    <div className="message-sender">{message.senderName}</div>
                    <div className="message-text">{message.text}</div>
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendAdminMessage()}
                placeholder="Type your response..."
              />
              <button onClick={sendAdminMessage} disabled={!newMessage.trim()}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a chat to start helping</h3>
            <p>Choose from the active chats on the left to begin assisting customers.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChatDashboard;
```

---

# 📱 Mobile Implementation (React Native)

## Chat Service
```javascript
// services/ChatService.js
import io from 'socket.io-client';

class ChatService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(token, userType = 'user') {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io('https://api.mydeeptech.ng', {
      auth: { token, userType }
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.emit('connection_status', { connected: false });
    });

    // Forward all socket events to listeners
    this.socket.onAny((eventName, ...args) => {
      this.emit(eventName, ...args[0]);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // Socket emit wrappers
  joinChatRoom(ticketId) {
    this.socket?.emit('join_chat_room', { ticketId });
  }

  sendMessage(ticketId, message, attachments = []) {
    this.socket?.emit('send_message', { ticketId, message, attachments });
  }

  startTyping(ticketId) {
    this.socket?.emit('user_typing', { ticketId, isTyping: true });
  }

  stopTyping(ticketId) {
    this.socket?.emit('user_typing', { ticketId, isTyping: false });
  }
}

export default new ChatService();
```

---

# 🔧 Error Handling & Status Codes

## HTTP Status Codes
- `200`: Success
- `201`: Created (new chat session)
- `400`: Bad Request (missing required fields)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (chat/ticket not found)
- `500`: Internal Server Error

## WebSocket Error Events
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  /*
  {
    type: 'authentication_failed',
    message: 'Invalid token provided',
    code: 'AUTH_ERROR'
  }
  */
});

socket.on('chat_error', (error) => {
  console.error('Chat error:', error);
  /*
  {
    type: 'message_failed',
    message: 'Failed to send message',
    ticketId: '674d8f9e1234567890abcdef'
  }
  */
});
```

---

# 🔄 Rate Limiting & Performance

## Rate Limits
- **REST API**: 100 requests per minute per user
- **WebSocket Messages**: 30 messages per minute per chat
- **Admin Actions**: 200 requests per minute

## Performance Optimization
- Use WebSocket for real-time features
- Implement message pagination for chat history
- Cache active chat data on frontend
- Implement reconnection logic for WebSocket failures

---

# 🧪 Testing

## Test WebSocket Connection
```javascript
// Test connection
const testSocket = io('https://api.mydeeptech.ng', {
  auth: { token: 'your-test-token', userType: 'user' }
});

testSocket.on('connect', () => {
  console.log('✅ WebSocket connected successfully');
});

testSocket.on('connect_error', (error) => {
  console.error('❌ WebSocket connection failed:', error);
});
```

## Test REST Endpoints
```bash
# Start chat session
curl -X POST https://api.mydeeptech.ng/api/chat/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test chat message"}'

# Get chat history
curl -X GET https://api.mydeeptech.ng/api/chat/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

This comprehensive documentation provides all the necessary endpoints, WebSocket events, and implementation examples needed to integrate the chat system into your frontend applications. The system supports both user and admin interfaces with real-time communication and proper error handling.