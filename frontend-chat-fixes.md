# Frontend Chat Widget Fixes

## Admin Chat Dashboard Issues & Fixes

### 1. **API Service Alignment**

The admin dashboard is using a custom hook `useAdminChat`, but the API calls need to match the backend endpoints:

```javascript
// Update your admin API service to use correct endpoints:
class AdminChatAPI {
  static async getActiveChatTickets(status = 'active') {
    const statusFilter = status === 'active' ? '?status=active' : `?status=${status}`;
    const response = await fetch(`/api/chat/admin/active${statusFilter}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  static async joinChat(ticketId) {
    const response = await fetch(`/api/chat/admin/join/${ticketId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  static async sendAdminMessage(ticketId, message) {
    // ❌ ENDPOINT DOES NOT EXIST! Need to create it or use alternative
    // For now, use the user chat endpoint (if it works for admins)
    const response = await fetch(`/api/chat/${ticketId}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message,
        isAdminReply: true 
      })
    });
    return response.json();
  }

  static async closeChatSession(ticketId, resolutionSummary = 'Chat session completed') {
    const response = await fetch(`/api/chat/admin/close/${ticketId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resolutionSummary })
    });
    return response.json();
  }
}
```

### 2. **Socket Service Connection for Admin**

```javascript
// Update your ChatSocketService for admin connections:
class ChatSocketService {
  static connect(token, userType = 'admin') {
    return new Promise((resolve, reject) => {
      this.socket = io('/', { // Use root namespace or specific admin namespace
        auth: { token },
        query: { userType },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('🔌 Admin connected to chat server');
        this.emit('connection_status', { connected: true });
        
        // Join admin room immediately
        this.socket.emit('join_admin_room');
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Admin disconnected:', reason);
        this.emit('connection_status', { connected: false, reason });
      });

      // Admin-specific event handlers
      this.socket.on('new_chat_ticket', (data) => {
        console.log('🎫 New chat ticket for admin:', data);
        this.emit('new_chat_ticket', data);
      });

      this.socket.on('user_message', (data) => {
        console.log('👤 User message for admin:', data);
        this.emit('user_message', data);
      });

      this.socket.on('message', (data) => {
        console.log('💬 New message for admin:', data);
        this.emit('new_message', data);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Admin connection error:', error);
        reject(error);
      });
    });
  }

  static joinAdminRoom() {
    if (this.socket?.connected) {
      this.socket.emit('join_admin_room');
    }
  }

  static joinChatRoom(ticketId) {
    if (this.socket?.connected) {
      this.socket.emit('join_ticket', { ticketId });
    }
  }

  static sendMessage(ticketId, message) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', {
        ticketId,
        message,
        isAdminReply: true,
        timestamp: new Date().toISOString()
      });
    }
  }

  static closeChat(ticketId, resolutionSummary) {
    if (this.socket?.connected) {
      this.socket.emit('close_chat', {
        ticketId,
        resolutionSummary
      });
    }
  }
}
```

### 3. **Fixed Socket Event Handlers**

Update the socket event listeners in your AdminChatDashboard:

```javascript
// Replace the socket event listeners section in useEffect:

ChatSocketService.on('new_chat_ticket', (data) => {
  console.log('🎫 New chat ticket received:', data);
  message.info(`New chat from ${data.userName || 'User'}`);
  loadChats(); // Refresh chat list
});

// Handle user messages - this fires when users send messages
ChatSocketService.on('user_message', (data) => {
  console.log('👤 User message received:', data);
  
  // Update chat list with latest message
  updateChatInList(data.ticketId, data.message);
  
  // Add to current chat if selected
  if (selectedChat && (selectedChat.ticketId === data.ticketId || selectedChat._id === data.ticketId)) {
    const newMsg = {
      _id: data.messageId || `msg-${Date.now()}`,
      sender: data.userId,
      senderModel: 'DTUser',
      senderName: data.userName || 'User',
      message: data.message,
      isAdminReply: false,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    setSelectedChatMessages(prev => {
      const exists = prev.find(m => m._id === newMsg._id);
      if (!exists) {
        return [...prev, newMsg];
      }
      return prev;
    });
    
    // Show notification
    message.info(`New message from ${newMsg.senderName}`);
  }
});

// Handle all messages - for echo confirmation and real-time sync
ChatSocketService.on('new_message', (data) => {
  console.log('💬 Message received:', data);
  
  // Determine if this is an admin message by checking sender email domain
  const senderEmail = data.senderEmail || data.userEmail || '';
  const isAdminMessage = senderEmail.includes('@mydeeptech.ng') || data.isAdminReply;
  
  // Only handle admin message echoes here (for confirmation)
  if (isAdminMessage && selectedChat && (selectedChat.ticketId === data.ticketId || selectedChat._id === data.ticketId)) {
    // This is an echo of our admin message - update pending status
    setSelectedChatMessages(prev => prev.map(msg => 
      msg.message === data.message && msg.isAdminReply && msg._id.startsWith('temp-')
        ? { ...msg, _id: data.messageId || data._id, timestamp: data.timestamp }
        : msg
    ));
  }
  // User messages are handled by 'user_message' event above
});

// Message delivery confirmation
ChatSocketService.on('message_sent', (data) => {
  console.log('✅ Message delivery confirmed:', data);
  // Update message status if needed
});
```

### 4. **Fix Message Sending Logic**

Update the `handleSendMessage` function:

```javascript
const handleSendMessage = async () => {
  if (!newMessage.trim() || !selectedChat) {
    return;
  }

  const messageText = newMessage.trim();
  const ticketId = selectedChat.ticketId || selectedChat._id;
  
  // Create temporary message for immediate UI feedback
  const tempMessage = {
    _id: `temp-${Date.now()}`,
    sender: 'admin',
    senderModel: 'Admin',
    senderName: 'You',
    message: messageText,
    isAdminReply: true,
    timestamp: new Date().toISOString(),
    pending: true
  };

  setSelectedChatMessages(prev => [...prev, tempMessage]);
  setNewMessage('');

  try {
    // Send via Socket.IO for real-time delivery
    if (isConnected) {
      ChatSocketService.sendMessage(ticketId, messageText);
    }

    // Send via API for reliability
    const result = await AdminChatAPI.sendAdminMessage(ticketId, messageText);
    
    if (result.success) {
      // Update the temporary message with real data
      setSelectedChatMessages(prev => prev.map(msg => 
        msg._id === tempMessage._id
          ? { 
              ...msg, 
              _id: result.data?.messageId || `msg-${Date.now()}`,
              pending: false,
              timestamp: result.data?.timestamp || msg.timestamp
            }
          : msg
      ));
      
      message.success('Message sent successfully');
    } else {
      throw new Error(result.error || 'Failed to send message');
    }
    
  } catch (error) {
    console.error('Failed to send message:', error);
    message.error('Failed to send message');
    
    // Remove failed message
    setSelectedChatMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
  }
};
```

### 5. **Data Structure Compatibility**

Update your chat data handling to match backend response:

```javascript
const handleJoinChat = async (chat) => {
  try {
    const result = await AdminChatAPI.joinChat(chat._id);
    
    if (result.success && result.data) {
      // Backend returns different structure - adapt it
      const chatData = result.data;
      
      setSelectedChatMessages(chatData.messages || []);
      
      // Update selected chat with backend data
      const updatedChat = {
        ...chat,
        userName: chatData.userName,
        userEmail: chatData.userEmail,
        ticketId: chatData.ticketId,
        status: chatData.status,
        assignedTo: chatData.assignedTo
      };
      
      setSelectedChat(updatedChat);
      
      // Join socket room
      if (isConnected) {
        ChatSocketService.joinChatRoom(chatData.ticketId);
      }
      
      message.success(`Joined chat with ${chatData.userName}`);
    } else {
      message.error(`Failed to join chat: ${result.message}`);
    }
  } catch (error) {
    console.error('Join chat error:', error);
    message.error('Failed to join chat');
  }
};
```

## User Chat Widget Fixes

## 1. Update Socket Event Listeners

```javascript
// Update these event listeners in your useEffect:

unsubscribers.push(
  EnhancedChatSocketService.on('active_tickets', (tickets) => { // Changed from 'active_tickets_loaded'
    console.log('📋 Loading active tickets:', tickets);
    setActiveTickets(tickets);
    if (tickets.length > 0 && !currentTicket) {
      selectTicket(tickets[0]);
    }
  })
);

// Update message handler for better compatibility
unsubscribers.push(
  EnhancedChatSocketService.on('new_message', (message) => {
    console.log('💬 Received new message:', message);
    
    // Better admin detection
    const isFromAdmin = message.senderModel === 'Admin' || 
                       message.isAdminReply === true ||
                       (message.senderEmail && message.senderEmail.includes('@mydeeptech.ng')) ||
                       (message.userEmail && message.userEmail.includes('@mydeeptech.ng'));
    
    // Use ticketId from message (backend sends this)
    const messageTicketId = message.ticketId;
    const currentTicketId = currentTicket?._id;
    
    if (currentTicket && messageTicketId === currentTicketId) {
      console.log('✅ Message is for current ticket, updating UI');
      
      if (isFromAdmin) {
        const adminMessage = {
          _id: message.messageId || message._id || `msg-${Date.now()}`,
          ticketId: messageTicketId,
          senderModel: 'Admin',
          senderName: message.senderName || message.userName || 'Support Agent',
          message: message.message,
          isAdminReply: true,
          timestamp: new Date(message.timestamp || Date.now())
        };
        
        setMessages(prev => {
          const exists = prev.find(m => m._id === adminMessage._id);
          if (!exists) {
            return [...prev, adminMessage];
          }
          return prev;
        });
        scrollToBottom();
        setHasUnreadMessages(false);
      }
    }
    
    // Show notification for admin messages when chat is not active
    if (isFromAdmin && (!isOpen || isMinimized || messageTicketId !== currentTicketId)) {
      setHasUnreadMessages(true);
      showMessageNotification({
        _id: message.messageId || `msg-${Date.now()}`,
        ticketId: messageTicketId,
        senderModel: 'Admin',
        senderName: message.senderName || message.userName || 'Support Agent',
        message: message.message,
        isAdminReply: true,
        timestamp: new Date(message.timestamp || Date.now())
      });
    }
  })
);
```

## 2. Update API Service Methods

Make sure your `EnhancedChatAPI` service uses the correct endpoints:

```javascript
// In your EnhancedChatAPI service file
class EnhancedChatAPI {
  static async getActiveChats() {
    const response = await fetch('/api/chat/active', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  static async startChat(message, category = 'general_inquiry', priority = 'medium') {
    const response = await fetch('/api/chat/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, category, priority })
    });
    return response.json();
  }

  static async getChatHistory(page = 1, limit = 50) {
    const response = await fetch(`/api/chat/history?page=${page}&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  static async sendMessage(ticketId, message) {
    const response = await fetch(`/api/chat/${ticketId}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    return response.json();
  }
}
```

## 3. Update Socket Service Connection

```javascript
// In your EnhancedChatSocketService
class EnhancedChatSocketService {
  static connect(token, userType = 'user') {
    if (this.socket?.connected) {
      console.log('Already connected');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket = io('/api/chat', { // Correct socket namespace
        auth: { token },
        query: { userType },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('🔌 Connected to chat server');
        this.emit('connection_status', { connected: true });
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected:', reason);
        this.emit('connection_status', { connected: false, reason });
      });

      // Auto-rejoin active chats on connection
      this.socket.on('active_tickets', (tickets) => {
        this.emit('active_tickets', tickets);
      });

      this.socket.on('chat_started', (data) => {
        this.emit('chat_started', data);
      });

      this.socket.on('message', (data) => {
        this.emit('new_message', data);
      });

      this.socket.on('agent_joined', (data) => {
        this.emit('agent_joined', data);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });
    });
  }

  static rejoinTicket(ticketId) {
    if (this.socket?.connected) {
      this.socket.emit('get_chat_history', { ticketId });
    }
  }

  static sendMessage(ticketId, message) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', {
        ticketId,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  static startChat(message, category = 'general_inquiry', priority = 'medium') {
    if (this.socket?.connected) {
      this.socket.emit('start_chat', {
        message,
        category,
        priority
      });
    }
  }
}
```

## 4. Fix Ticket Selection Logic

```javascript
const selectTicket = useCallback((ticket) => {
  console.log('🎯 Selecting ticket:', ticket.ticketNumber);
  setCurrentTicket(ticket);
  setMessages(ticket.messages || []);
  
  // Join ticket room using the correct event
  const socket = EnhancedChatSocketService.getSocket();
  if (socket) {
    console.log('🏠 Joining chat room for ticket:', ticket._id);
    // Use the backend's expected event name
    socket.emit('get_chat_history', { ticketId: ticket._id });
  }
  
  scrollToBottom();
  setHasUnreadMessages(false);
}, []);
```

## 5. Add Error Handling for API Calls

```javascript
const loadChatHistory = async () => {
  try {
    setHistoryLoading(true);
    const result = await EnhancedChatAPI.getChatHistory(1, 50);
    console.log('📚 Chat history response:', result);
    
    if (result.success && result.data) {
      if ('history' in result.data && Array.isArray(result.data.history)) {
        setChatHistory(result.data.history);
        setShowHistoryDrawer(true);
      } else if (Array.isArray(result.data)) {
        setChatHistory(result.data);
        setShowHistoryDrawer(true);
      } else {
        showNotification('No chat history found', 'info');
      }
    } else {
      showNotification(result.message || 'Failed to load chat history', 'error');
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
    message.error('Failed to load chat history');
  } finally {
    setHistoryLoading(false);
  }
};
```