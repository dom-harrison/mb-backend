var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http, {
  pingTimeout: 60000,
});

const makeHandlers = require('./handlers');
const RoomManager = require('./RoomManager');
const UserManager = require('./UserManager');
const roomManager = RoomManager();
const userManager = UserManager();

app.get('/', (req, res) => {
  res.send('Mafia Bros!');
});

io.on('connection', (socket) => {

  const { 
    handleConnection,
    handleLogin,
    handleLogout,
    handleJoinRoom,
    handleLeaveRoom,
    handleStartGame,
    handleAction,
    handleDisconnected,
  } = makeHandlers(io, socket, roomManager, userManager);

  handleConnection();

  socket.on('login', handleLogin);

  socket.on('logout', handleLogout);

  socket.on('join_room', handleJoinRoom);

  socket.on('leave_room', handleLeaveRoom);

  socket.on('start_game', handleStartGame);

  socket.on('action', handleAction);

  socket.on('disconnected', handleDisconnected);
  
});

http.listen(4000, '0.0.0.0', () => {
  console.log('listening on *:4000');
});