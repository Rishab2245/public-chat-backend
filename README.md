# WhatsApp-like Chat Application - Backend

## Overview
The backend of this real-time chat application is responsible for handling all server-side logic, including managing WebSocket connections, storing and retrieving messages, and providing RESTful API endpoints for message management. It supports real-time communication and basic CRUD operations for messages.

## Features
*   **Real-time messaging**: Facilitates WebSocket communication using Socket.IO.
*   **CRUD operations for messages**:
    *   Receives and stores new messages.
    *   Updates existing messages in the database.
    *   Deletes messages from the database.
    *   Serves message history.
*   **User identification**: Manages messages based on sender IDs.
*   **Database persistence**: Stores messages in MongoDB (with an in-memory fallback for development).
*   **Cross-Origin Resource Sharing (CORS)**: Configured to allow communication from the frontend.

## Tech Stack
*   **Node.js**: JavaScript runtime environment.
*   **Express.js**: Web application framework for building REST APIs.
*   **Socket.IO**: Library for real-time, bidirectional, event-based communication (WebSockets).
*   **MongoDB**: NoSQL database for storing messages.
*   **CORS**: Middleware for enabling cross-origin requests.

## Project Structure
