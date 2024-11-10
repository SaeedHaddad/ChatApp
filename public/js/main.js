//client-side javascript
const chatForm = document.getElementById('chat-form');//to access the form element in chat.html
const chatMessages = document.querySelector('.chat-messages')

//Get username and room from URL
const {username, room} = Qs.parse(location.search,{
    ignoreQueryPrefix: true
});


const socket = io();//this is accessible through the script added in chat.html

//Join Chatroom
socket.emit('joinRoom', {username, room})



//Message from server
socket.on('message', message =>{
    console.log(message);
    outputMessage(message);

    //Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
})


//Message submit
chatForm.addEventListener('submit',(e)=>{
    e.preventDefault();

    //Get message text
    const msg = e.target.elements.msg.value; //when we submit the form this gets the message from the text input and then log it on the client side.
    //console.log(msg);
    //Emit message to server
    socket.emit('chatMessage', msg);
    //Clear input
    e.target.elements.msg.value = "";
    e.target.elements.msg.focus();
    
})

//Output Message to DOM
function outputMessage(message){
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML=`<p class = "meta">${message.username} <span>${message.time}</span></p>
    <p class="text">
    ${message.text}
    </p>`;
    document.querySelector('.chat-messages').appendChild(div);
}
