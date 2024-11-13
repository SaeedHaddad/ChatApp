const path = require("path");
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const formatMessage = require("./utils/messages");
const { userJoin, getCurrentUser, userLeave } = require("./utils/users");
const redis = require("redis");
require("dotenv").config();
const { createClient } = redis;

const app = express(); //Create an express instance
const server = http.createServer(app);
const io = socketIO(server);

// Set static folder to serve HTML and frontend assets
app.use(express.static(path.join(__dirname, "public")));
const botName = "ChatBot";

// Redis setup
(async () => {
  try {
    // Create Redis client and connect
    const client = createClient({ url: "redis://127.0.0.1:6379" });
    await client.connect();
    console.log("Connected to Redis successfully.");

    // Store a message in Redis using a sorted set
    const storeMessage = async (room, message) => {
      const timestamp = new Date().getTime(); // Generate unique timestamp
      const messageKey = `room:${room}:messages`; // Redis key for room messages
      // Add the message to the sorted set, ordered by timestamp
      await client.zAdd(messageKey, {
        score: timestamp,
        value: JSON.stringify({
          ...message,
          timestamp,
        }),
      });
    };

    // Retrieve messages for a specific room from Redis
    const getMessages = async (room, limit = 50) => {
      const messageKey = `room:${room}:messages`;
      // Get the latest 'limit' messages, ordered by timestamp
      const messages = await client.zRange(messageKey, -limit, -1);
      return messages.map((msg) => JSON.parse(msg)); // Parse JSON for each message
    };

    // Add a user to a specific room in Redis using a hash
    const addUserToRoom = async (room, userId, username) => {
      const roomUsersKey = `room:${room}:users`; // Redis key for room users
      await client.hSet(roomUsersKey, userId, username); // Store user in hash
    };

    // Get all users in a specific room from Redis
    const getRoomUsers = async (room) => {
      const roomUsersKey = `room:${room}:users`;
      const users = await client.hGetAll(roomUsersKey); // Retrieve all users
      return Object.entries(users).map(([id, username]) => ({
        id,
        username,
      }));
    };

    // Remove a user from a room in Redis
    const removeUserFromRoom = async (room, userId) => {
      const roomUsersKey = `room:${room}:users`;
      await client.hDel(roomUsersKey, userId); // Remove user from hash
    };

    // Socket.io events to handle real-time communication
    io.on("connection", (socket) => {
      // Event for joining a chat room
      socket.on("joinRoom", async ({ username, room }) => {
        const user = userJoin(socket.id, username, room);

        // Add user to Redis and join the Socket.io room
        await addUserToRoom(room, socket.id, username);
        socket.join(user.room);

        // Fetch and send previous messages from Redis to the user
        const messages = await getMessages(room);
        messages.forEach((message) => socket.emit("message", message));

        // Send a welcome message to the current user
        const welcomeMessage = formatMessage(botName, "Welcome to ChatApp!");
        await storeMessage(room, welcomeMessage); // Store the welcome message in Redis
        socket.emit("message", welcomeMessage);

        // Broadcast when a user joins the room, notify other users
        const joinMessage = formatMessage(
          botName,
          `${user.username} has joined the chat.`
        );
        await storeMessage(room, joinMessage); // Store join message
        socket.broadcast.to(user.room).emit("message", joinMessage);

        // Send updated room users list to all users in the room
        const users = await getRoomUsers(user.room);
        io.to(user.room).emit("roomUsers", {
          room: user.room,
          users: users,
        });
      });

      // Listen for chatMessage event when a user sends a message
      socket.on("chatMessage", async (msg) => {
        const user = getCurrentUser(socket.id);
        if (user) {
          const message = formatMessage(user.username, msg);
          await storeMessage(user.room, message); // Store the message in Redis
          io.to(user.room).emit("message", message); // Send message to the room
        }
      });

      // Event for handling manual user leave
      socket.on("leaveRoom", async () => {
        const user = getCurrentUser(socket.id);
        if (user) {
          await removeUserFromRoom(user.room, socket.id); // Remove user from Redis

          // Notify other users that the user has left
          const leaveMessage = formatMessage(
            botName,
            `${user.username} has left the chat.`
          );
          await storeMessage(user.room, leaveMessage); // Store leave message
          io.to(user.room).emit("message", leaveMessage);

          // Send updated room users list to all users in the room
          const users = await getRoomUsers(user.room);
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: users,
          });
        }
      });

      // Handle user disconnecting (e.g., closing the browser)
      socket.on("disconnect", async () => {
        const user = userLeave(socket.id);
        if (user) {
          await removeUserFromRoom(user.room, socket.id); // Remove user from Redis

          // Notify others that the user disconnected
          const disconnectMessage = formatMessage(
            botName,
            `${user.username} has left the chat.`
          );
          await storeMessage(user.room, disconnectMessage); // Store disconnect message
          io.to(user.room).emit("message", disconnectMessage);

          // Send updated room users list to all users in the room
          const users = await getRoomUsers(user.room);
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: users,
          });
        }
      });
    });
  } catch (error) {
    console.error("Error connecting to Redis:", error);
  }
})();

// Set server to listen on specified port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
