const path = require("path");
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const { userJoin, getCurrentUser, userLeave } = require("./utils/users");
const redis = require("redis");
require("dotenv").config();
const { createClient } = redis;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));
const botName = "ChatBot";

// Redis setup
(async () => {
  try {
    const client = createClient({ url: "redis://127.0.0.1:6379" });
    await client.connect();
    console.log("Connected to Redis successfully.");

    // Store a message in Redis
    const storeMessage = async (room, messageId, message) => {
      const messageKey = `message:${room}:${messageId}`;
      await client.set(messageKey, JSON.stringify(message));
    };

    // Retrieve messages for a specific room from Redis
    const getMessages = async (room) => {
      const keys = await client.keys(`message:${room}:*`);
      const messages = await Promise.all(keys.map((key) => client.get(key)));
      return messages.map((msg) => JSON.parse(msg));
    };

    // Add a user to a specific room in Redis
    const addUserToRoom = async (room, userId, username) => {
      const userKey = `user:${room}:${userId}`;
      await client.set(userKey, username);
    };

    // Get all users in a specific room from Redis
    const getRoomUsers = async (room) => {
      const userKeys = await client.keys(`user:${room}:*`);
      const users = await Promise.all(
        userKeys.map(async (key) => {
          const username = await client.get(key);
          return { id: key.split(":")[2], username };
        })
      );
      return users;
    };

    // Remove a user from a room in Redis
    const removeUserFromRoom = async (room, userId) => {
      const userKey = `user:${room}:${userId}`;
      await client.del(userKey);
    };

    // Socket.io events
    io.on("connection", (socket) => {
      socket.on("joinRoom", async ({ username, room }) => {
        const user = userJoin(socket.id, username, room);

        // Add user to Redis and join the room
        await addUserToRoom(room, socket.id, username);
        socket.join(user.room);

        // Fetch and send previous messages
        const messages = await getMessages(room);
        messages.forEach((message) => socket.emit("message", message));

        // Welcome current user
        socket.emit("message", formatMessage(botName, "Welcome to ChatApp!"));

        // Broadcast when a user connects
        socket.broadcast
          .to(user.room)
          .emit(
            "message",
            formatMessage(botName, `${user.username} has joined the chat.`)
          );

        // Send room users info
        const users = await getRoomUsers(user.room);
        io.to(user.room).emit("roomUsers", {
          room: user.room,
          users: users,
        });
      });

      // Listen for chatMessage
      socket.on("chatMessage", async (msg) => {
        const user = getCurrentUser(socket.id);
        const message = formatMessage(user.username, msg);

        // Save message in Redis
        const messageId = new Date().getTime(); // Simple unique ID based on timestamp
        await storeMessage(user.room, messageId, message);

        // Emit message to room
        io.to(user.room).emit("message", message);
      });

      // Handle user leaving the room
      socket.on("leaveRoom", async () => {
        const user = getCurrentUser(socket.id);
        if (user) {
          await removeUserFromRoom(user.room, socket.id);

          // Broadcast that the user has left
          io.to(user.room).emit(
            "message",
            formatMessage(botName, `${user.username} has left the chat.`)
          );

          // Update room user info
          const users = await getRoomUsers(user.room);
          io.to(user.room).emit("roomUsers", {
            room: user.room,
            users: users,
          });
        }
      });

      // Runs when client disconnects
      socket.on("disconnect", async () => {
        const user = userLeave(socket.id);
        if (user) {
          await removeUserFromRoom(user.room, socket.id);

          // Broadcast that the user has left
          io.to(user.room).emit(
            "message",
            formatMessage(botName, `${user.username} has left the chat.`)
          );

          // Update room user info
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
