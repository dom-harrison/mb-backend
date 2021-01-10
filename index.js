var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http, {
  pingTimeout: 60000,
});
const PORT = process.env.PORT || 4000;
const ENV = process.env.ENV || 'development';
console.log('Environment: ' + ENV);

const admin = require('firebase-admin');
let serviceAccount;

if (ENV === 'development') {
  serviceAccount = require('./fb-service-account.json');
}

admin.initializeApp({
  credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
});

const db = admin.firestore();

const makeHandlers = require('./handlers');
const RoomManager = require('./RoomManager');
const UserManager = require('./UserManager');
const roomManager = RoomManager(db, io);
const userManager = UserManager(db);

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
  } = makeHandlers(socket, roomManager, userManager);

  handleConnection();

  socket.on('login', handleLogin);

  socket.on('logout', handleLogout);

  socket.on('join_room', handleJoinRoom);

  socket.on('leave_room', handleLeaveRoom);

  socket.on('start_game', handleStartGame);

  socket.on('action', handleAction);

  socket.on('disconnected', handleDisconnected);
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`listening on port: ${PORT}`);
});