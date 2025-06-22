const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
dotenv = require('dotenv');
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'chatapp';
let db;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db(DB_NAME);
  })
  .catch(error => {
    console.error('MongoDB connection error:', error);
    // For demo purposes, we'll use in-memory storage if MongoDB is not available
    console.log('Using in-memory storage as fallback');
  });

// In-memory storage as fallback
let messages = [];

// Helper function to get messages collection or fallback to in-memory
const getMessages = async () => {
  if (db) {
    return await db.collection('messages').find().sort({ timestamp: 1 }).toArray();
  }
  return messages;
};

const saveMessage = async (message) => {
  if (db) {
    const result = await db.collection('messages').insertOne(message);
    return { ...message, _id: result.insertedId };
  } else {
    message._id = uuidv4();
    messages.push(message);
    return message;
  }
};

const updateMessage = async (messageId, content) => {
  if (db) {
    const result = await db.collection('messages').updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { content, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } else {
    const messageIndex = messages.findIndex(msg => msg._id === messageId);
    if (messageIndex !== -1) {
      messages[messageIndex].content = content;
      messages[messageIndex].updatedAt = new Date();
      return true;
    }
    return false;
  }
};

const deleteMessage = async (messageId) => {
  if (db) {
    const result = await db.collection('messages').deleteOne({ _id: new ObjectId(messageId) });
    return result.deletedCount > 0;
  } else {
    const messageIndex = messages.findIndex(msg => msg._id === messageId);
    if (messageIndex !== -1) {
      messages.splice(messageIndex, 1);
      return true;
    }
    return false;
  }
};

// REST API endpoints
app.get('/api/messages', async (req, res) => {
  try {
    const allMessages = await getMessages();
    res.json(allMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { senderId, content, conversationId } = req.body;
    
    if (!senderId || !content) {
      return res.status(400).json({ error: 'senderId and content are required' });
    }

    const message = {
      senderId,
      content,
      conversationId: conversationId || 'general',
      timestamp: new Date(),
      createdAt: new Date()
    };

    const savedMessage = await saveMessage(message);
    
    // Broadcast the new message to all connected clients
    io.emit('newMessage', savedMessage);
    
    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

app.put('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const updated = await updateMessage(id, content);
    
    if (updated) {
      // Broadcast the message update to all connected clients
      io.emit('messageUpdated', { messageId: id, content });
      res.json({ success: true, message: 'Message updated successfully' });
    } else {
      res.status(404).json({ error: 'Message not found' });
    }
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await deleteMessage(id);
    
    if (deleted) {
      // Broadcast the message deletion to all connected clients
      io.emit('messageDeleted', { messageId: id });
      res.json({ success: true, message: 'Message deleted successfully' });
    } else {
      res.status(404).json({ error: 'Message not found' });
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send existing messages to newly connected client
  getMessages().then(allMessages => {
    socket.emit('existingMessages', allMessages);
  });

  // Handle new message via WebSocket
  socket.on('sendMessage', async (data) => {
    try {
      const { senderId, content, conversationId } = data;
      
      if (!senderId || !content) {
        socket.emit('error', { message: 'senderId and content are required' });
        return;
      }

      const message = {
        senderId,
        content,
        conversationId: conversationId || 'general',
        timestamp: new Date(),
        createdAt: new Date()
      };

      const savedMessage = await saveMessage(message);
      
      // Broadcast to all connected clients
      io.emit('newMessage', savedMessage);
    } catch (error) {
      console.error('Error handling sendMessage:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle message update via WebSocket
  socket.on('updateMessage', async (data) => {
    try {
      const { messageId, content } = data;
      
      if (!messageId || !content) {
        socket.emit('error', { message: 'messageId and content are required' });
        return;
      }

      const updated = await updateMessage(messageId, content);
      
      if (updated) {
        io.emit('messageUpdated', { messageId, content });
      } else {
        socket.emit('error', { message: 'Message not found' });
      }
    } catch (error) {
      console.error('Error handling updateMessage:', error);
      socket.emit('error', { message: 'Failed to update message' });
    }
  });

  // Handle message deletion via WebSocket
  socket.on('deleteMessage', async (data) => {
    try {
      const { messageId } = data;
      
      if (!messageId) {
        socket.emit('error', { message: 'messageId is required' });
        return;
      }

      const deleted = await deleteMessage(messageId);
      
      if (deleted) {
        io.emit('messageDeleted', { messageId });
      } else {
        socket.emit('error', { message: 'Message not found' });
      }
    } catch (error) {
      console.error('Error handling deleteMessage:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

