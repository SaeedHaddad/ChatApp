//client-side javascript
const chatForm = document.getElementById("chat-form"); //to access the form element in chat.html
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
const leaveButton = document.getElementById("leave-btn"); // Add reference to leave button

//Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const socket = io(); //this is accessible through the script added in chat.html

//Join Chatroom
socket.emit("joinRoom", { username, room });

//Get room and users
socket.on("roomUsers", ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

//Message from server
socket.on("message", (message) => {
  console.log(message);
  outputMessage(message);

  //Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

//Message submit
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  //Get message text
  const msg = e.target.elements.msg.value; //when we submit the form this gets the message from the text input and then log it on the client side.
  //console.log(msg);
  //Emit message to server
  socket.emit("chatMessage", msg);
  //Clear input
  e.target.elements.msg.value = "";
  e.target.elements.msg.focus();
});

//Output Message to DOM
function outputMessage(message) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<p class = "meta">${message.username} <span>${message.time}</span></p>
    <p class="text">
    ${message.text}
    </p>`;
  document.querySelector(".chat-messages").appendChild(div);
}

//Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.innerText = user.username;
    userList.appendChild(li);
  });
}

// Listen for the "Leave Room" button click
leaveButton.addEventListener("click", () => {
  socket.emit("leaveRoom"); // Emit the leaveRoom event to the server
  window.location.href = "/"; // Optionally redirect the user to the homepage or another page
});
