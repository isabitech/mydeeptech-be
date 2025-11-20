# 💬 Frontend Chat Integration Guide

## 🔗 **Socket.IO + REST API Integration**

This guide shows how to implement a complete chat system in your frontend that works seamlessly with users getting their responses back easily.

---

## 📋 **Complete Chat Flow Implementation**

### **1. Initial Setup & Connection**

```javascript
// ChatService.js
import io from 'socket.io-client';

class ChatService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentTicket = null;
    this.messageCallback = null;
    this.ticketCallback = null;
  }

  // Connect to Socket.IO server
  connect(token) {
    this.socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['polling', 'websocket']
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      this.isConnected = true;
    });

    // Listen for active tickets on connection
    this.socket.on('active_tickets', (data) => {
      console.log('📋 Active tickets received:', data.tickets);
      if (this.ticketCallback) {
        this.ticketCallback(data.tickets);
      }
    });

    // Listen for new messages
    this.socket.on('new_message', (message) => {
      console.log('💬 New message received:', message);
      if (this.messageCallback) {
        this.messageCallback(message);
      }
    });

    // Listen for chat history
    this.socket.on('chat_history', (data) => {
      console.log('📋 Chat history received:', data);
      this.currentTicket = data;
      if (this.ticketCallback) {
        this.ticketCallback([data]);
      }
    });

    // Listen for ticket rejoined
    this.socket.on('ticket_rejoined', (data) => {
      console.log('🔄 Ticket rejoined:', data);
      this.currentTicket = data;
      if (this.ticketCallback) {
        this.ticketCallback([data]);
      }
    });

    // Listen for chat started
    this.socket.on('chat_started', (data) => {
      console.log('🚀 Chat started:', data);
      this.currentTicket = data;
      if (this.ticketCallback) {
        this.ticketCallback([data]);
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Chat error:', error);
    });
  }

  // Set callback for new messages
  onMessage(callback) {
    this.messageCallback = callback;
  }

  // Set callback for ticket updates
  onTicketUpdate(callback) {
    this.ticketCallback = callback;
  }
}

export default new ChatService();
```

---

### **2. REST API Integration**

```javascript
// ChatAPI.js
const API_BASE = 'http://localhost:5000/api/chat';

class ChatAPI {
  constructor(token) {
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Start new chat session
  async startChat(message, category = 'general_inquiry', priority = 'medium') {
    const response = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message, category, priority })
    });
    return response.json();
  }

  // Get active chats for current user
  async getActiveChats() {
    const response = await fetch(`${API_BASE}/active`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get chat history
  async getChatHistory(page = 1, limit = 10) {
    const response = await fetch(`${API_BASE}/history?page=${page}&limit=${limit}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Get specific ticket details
  async getTicketDetails(ticketId) {
    const response = await fetch(`${API_BASE}/${ticketId}`, {
      headers: this.headers
    });
    return response.json();
  }

  // Send message via REST (fallback)
  async sendMessage(ticketId, message, attachments = []) {
    const response = await fetch(`${API_BASE}/${ticketId}/message`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message, attachments })
    });
    return response.json();
  }
}

export default ChatAPI;
```

---

### **3. React Chat Component Example**

```jsx
// ChatComponent.jsx
import React, { useState, useEffect, useRef } from 'react';
import ChatService from './ChatService';
import ChatAPI from './ChatAPI';

const ChatComponent = ({ userToken }) => {
  const [messages, setMessages] = useState([]);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTickets, setActiveTickets] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  
  const chatAPI = new ChatAPI(userToken);

  useEffect(() => {
    // Initialize chat service
    ChatService.connect(userToken);

    // Load active chats on component mount
    loadActiveChats();

    // Set up message listener
    ChatService.onMessage((message) => {
      if (currentTicket && message.ticketId === currentTicket.ticketId) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      }
    });

    // Set up ticket update listener
    ChatService.onTicketUpdate((tickets) => {
      setActiveTickets(tickets);
      if (tickets.length > 0) {
        const ticket = tickets[0];
        setCurrentTicket(ticket);
        setMessages(ticket.messages || []);
        scrollToBottom();
      }
    });

    return () => {
      if (ChatService.socket) {
        ChatService.socket.disconnect();
      }
    };
  }, [userToken]);

  const loadActiveChats = async () => {
    try {
      const result = await chatAPI.getActiveChats();
      if (result.success) {
        setActiveTickets(result.data.activeChats);
        
        // Auto-select first active chat
        if (result.data.activeChats.length > 0) {
          const ticket = result.data.activeChats[0];
          setCurrentTicket(ticket);
          setMessages(ticket.messages || []);
          
          // Rejoin the ticket room via Socket.IO
          ChatService.socket.emit('rejoin_ticket', { ticketId: ticket._id });
        }
      }
    } catch (error) {
      console.error('Error loading active chats:', error);
    }
  };

  const startNewChat = async () => {
    try {
      const result = await chatAPI.startChat(
        "Hello, I need support",
        "general_inquiry",
        "medium"
      );
      
      if (result.success) {
        setCurrentTicket(result.data);
        setMessages(result.data.messages || []);
        
        // Start chat via Socket.IO for real-time updates
        ChatService.socket.emit('start_chat', {
          message: "Hello, I need support",
          category: "general_inquiry",
          priority: "medium"
        });
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !currentTicket) return;

    // Send via Socket.IO for real-time delivery
    ChatService.socket.emit('send_message', {
      ticketId: currentTicket.ticketId || currentTicket._id,
      message: newMessage,
      attachments: []
    });

    // Add message to local state immediately for better UX
    const tempMessage = {
      message: newMessage,
      sender: 'user',
      isAdminReply: false,
      timestamp: new Date(),
      senderName: 'You'
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();
  };

  const selectTicket = (ticket) => {
    setCurrentTicket(ticket);
    setMessages(ticket.messages || []);
    
    // Rejoin ticket room for real-time updates
    ChatService.socket.emit('rejoin_ticket', { ticketId: ticket._id });
    scrollToBottom();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="chat-container">
      {/* Ticket Sidebar */}
      <div className="ticket-sidebar">
        <h3>Active Chats</h3>
        <button onClick={startNewChat}>Start New Chat</button>
        
        {activeTickets.map(ticket => (
          <div 
            key={ticket._id} 
            className={`ticket-item ${currentTicket?._id === ticket._id ? 'active' : ''}`}
            onClick={() => selectTicket(ticket)}
          >
            <div className="ticket-number">{ticket.ticketNumber}</div>
            <div className="ticket-status">{ticket.status}</div>
            <div className="ticket-time">
              {new Date(ticket.lastUpdated).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {currentTicket && (
          <div className="chat-header">
            <h4>Chat: {currentTicket.ticketNumber}</h4>
            <span className="status">{currentTicket.status}</span>
          </div>
        )}

        <div className="messages-container">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.isAdminReply ? 'admin' : 'user'}`}
            >
              <div className="message-sender">
                {message.senderName || (message.isAdminReply ? 'Support Agent' : 'You')}
              </div>
              <div className="message-text">{message.message}</div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        {currentTicket && (
          <div className="message-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatComponent;
```

---

## 🔧 **Key Features Implemented**

### **✅ Real-time Messaging**
- Socket.IO for instant message delivery
- Automatic room management (users join their ticket rooms)
- Admin-to-user and user-to-admin messaging

### **✅ Session Persistence**
- Users automatically rejoin active tickets on connection
- Chat history is preserved across sessions
- Multiple active chats support

### **✅ REST API Fallbacks**
- Complete REST API for all operations
- Works without WebSocket connection
- Perfect for mobile/unreliable networks

### **✅ User Experience**
- Auto-load active chats on page load
- Real-time message updates
- Easy ticket switching
- Message status indicators

---

## 🎯 **Frontend Implementation Steps**

### **Step 1: Install Dependencies**
```bash
npm install socket.io-client
```

### **Step 2: Set Up Authentication**
```javascript
// Get JWT token from your auth system
const token = localStorage.getItem('auth_token');
```

### **Step 3: Initialize Chat Service**
```javascript
// In your main app component
useEffect(() => {
  if (userToken) {
    ChatService.connect(userToken);
  }
}, [userToken]);
```

### **Step 4: Handle Socket.IO Events**
```javascript
// Key events to listen for:
- 'active_tickets' - Get user's active chats on connect
- 'new_message' - Receive real-time messages
- 'chat_started' - New chat session created
- 'chat_history' - Historical messages loaded
- 'ticket_rejoined' - Successfully rejoined a ticket
```

### **Step 5: API Integration**
```javascript
// Essential API calls:
GET  /api/chat/active     - Get active chats
GET  /api/chat/history    - Get chat history  
POST /api/chat/start      - Start new chat
GET  /api/chat/:ticketId  - Get specific chat
POST /api/chat/:ticketId/message - Send message (fallback)
```

---

## 🚀 **Testing the Implementation**

1. **User starts chat**: Message appears immediately
2. **Admin responds**: User gets real-time notification
3. **User refreshes page**: Auto-rejoins active chats
4. **Network disconnection**: REST API provides fallback
5. **Multiple chats**: User can switch between tickets

Your chat system now provides a seamless experience where users can easily get their responses and send messages with full session persistence! 🎉