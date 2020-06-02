var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http, {
  pingTimeout: 60000,
});

const makeHandlers = require('./handlers');
const RoomManager = require('./RoomManager');
const roomManager = RoomManager();

app.get('/', (req, res) => {
  res.send('Mafia Bros!');
});

io.on('connection', (socket) => {

  const { 
    handleLogin,
    handleLeaveRoom,
    handleStartGame,
    handleAction,
    handleDisconnecting,
  } = makeHandlers(socket, roomManager);

  socket.on('login', handleLogin);

  socket.on('leave_room', handleLeaveRoom);

  socket.on('start_game', handleStartGame);

  socket.on('action', handleAction);

  socket.on('disconnecting', handleDisconnecting);
  
});

http.listen(4000, '0.0.0.0', () => {
  console.log('listening on *:4000');
});