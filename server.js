const path = require("path"); // includes the 'path' module to help with file and directory path manipulations.
const express = require("express"); //includes the express module so we can use it in the app.
const http = require("http");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

const app = express(); //creates an instance of Express by calling express() and gives access to all its methods like (app.get, app.post, app.listen)
const server = http.createServer(app);
const io = socketio(server);

//Set static folder
//we want the public folder set as the static folder so we can access the HTML files to display our frontend, so we write the following express code while including the path module which is a node js core module
app.use(express.static(path.join(__dirname, "public")));
const botName = "ChatBot";

//Run when a client connects
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);
    //Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to ChatApp!")); //socket.emit => sends message to the single user

    //Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat.`)
      ); //socket.broadcast.emit => sends a message to all the clients except the single client

    //Send users and room info (sidebar)
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  //Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  // Handle user leaving the room manually
  socket.on("leaveRoom", () => {
    const user = getCurrentUser(socket.id); // Get the current user

    if (user) {
      // Remove the user from the room
      userLeave(socket.id);

      // Broadcast message that the user has left
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat.`)
      );

      // Send updated users and room info (sidebar)
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });

  //Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat.`)
      ); //io.emit => sends a message to all clients in general

      //Send users and room info (sidebar)
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000; // use the port from environment variables if available, otherwise default to 3000.

server.listen(PORT, () => console.log(`Server is running on port: ${PORT}`)); // starts the server and makes it listen for incoming requests on the specified port.
