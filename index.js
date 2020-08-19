var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http, {
  pingTimeout: 60000,
});

console.log(app.settings.env);
const devEnvironment = app.settings.env === 'development';
const admin = require('firebase-admin');
const serviceAccount = require('./fb-service-account.json');

admin.initializeApp({
  credential: devEnvironment ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function quickstartListen(db) {
  const snapshot = await db.collection('mafia-bros-db').get();
  snapshot.forEach((doc) => {
    console.log(doc.id, '=>', doc.data());
  });
}

quickstartListen(db);

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