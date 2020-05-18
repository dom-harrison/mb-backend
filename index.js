var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const users = {};
const rooms = {};
const roomUsers = {};
const roles = ['mafia', 'villager', 'villager', 'mafia', 'villager', 'villager']

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


io.on('connection', (socket) => {
    const { id } = socket.client;
    let room;
    let user;

    socket.on('login', ({ name, roomName }) => {
      console.log('login: ', name );
      users[id] = name;
      room = roomName;
      user = {
        name,
        id
      };

      socket.join(roomName);

      if (rooms[room] && roomUsers[room]) {
        roomUsers[room].push(user);
      } else {
        rooms[room] = {
          name: room,
          dayCount: 0,
          nightTime: false,
          message: '',
          votes: {},
          voteCount: 0,
          aliveCount: 0,
          hidden: {
            roles: [],
            actions: { mafia: {} },
            actionCount: 0,
            expectedActions: 0,
          }
        };
        roomUsers[room] = [user];
      }

      const roomStatus = { ...rooms[room] };
      io.to(room).emit('room_status', roomStatus);
      io.to(room).emit('room_users', roomUsers[room]);
    });

    socket.on('leave_room', () => {
      socket.leave(room);
      if (roomUsers[room]) {
        roomUsers[room] = roomUsers[room].filter(us => us.name !== user.name);
      }
      io.to(room).emit('room_users', roomUsers[room]);
    });



    socket.on('start_game', () => {
      console.log('start_game in room', room);
      const gameRoles = shuffleArray(roles.slice(0, (roomUsers[room].length)));
      const mafiaUsers = []

      // Assign roles, send roles to non-mafia, create mafia array
      gameRoles.forEach((gameRole, ix) => {
        const socketId = roomUsers[room][ix].id;
        rooms[room].hidden.roles[ix] = [gameRole];
        if (gameRole !== 'villager') {
          rooms[room].hidden.expectedActions ++
        } 
        if (gameRole !== 'mafia') {
          io.to(socketId).emit('room_users', [{ name: roomUsers[room][ix].name, role: gameRole }]);
        } else {
          mafiaUsers.push({ name: roomUsers[room][ix].name, role: gameRole })
        }
      });

      // Send all mafia users to all mafia
      gameRoles.forEach((gameRole, ix) => {
        const socketId = roomUsers[room][ix].id;
        if (gameRole === 'mafia') {
          io.to(socketId).emit('room_users', mafiaUsers);
        }
      });

      rooms[room].aliveCount = roomUsers[room].length;
      rooms[room].dayCount = 1;
      rooms[room].nightTime = true;
      const roomStatus = { ...rooms[room] };
      io.to(room).emit('room_status', roomStatus);
    });


    socket.on('action', ({ target, role }) => {
      console.log('action:', user, target, role)
      if (rooms[room].nightTime) {
        const actions = { ...rooms[room].hidden.actions };
        rooms[room].hidden.actionCount++;

        if (role === 'mafia') {
          actions.mafia[target] = actions.mafia[target] ? actions.mafia[target]++ : 1;
        } else if (role === 'police') {
          io.to(id).emit('private_message', `${target} is... `);
        } else {
          actions[role] = target;
        }

        rooms[room].hidden.actions = actions;
        const roomStatus = { ...rooms[room] };
        io.to(room).emit('room_status', roomStatus);
  
        if (rooms[room].hidden.actionCount === rooms[room].hidden.expectedActions) {
          let killUser = undefined;
          Object.keys(actions.mafia).forEach(trgt => {
            if (!killUser || actions.mafia[trgt] > actions.mafia[killUser]) {
              killUser = trgt;
            }
          })
          if (actions.doctor && actions.doctor === killUser) {
            rooms[room].message = `${killUser} was saved by the doctor`;
            killUser = undefined;
          } else {
            const killUserIx = roomUsers[room].findIndex(user => user.name === killUser);
            if (rooms[room].hidden.roles[killUserIx] !== 'villager') { rooms[room].hidden.expectedActions--; }
            rooms[room].aliveCount--;
            rooms[room].message = `${killUser} was killed by the mafia`;
            io.to(room).emit('room_users', [{ name: killUser, dead: true }]);
          }
          
          rooms[room].dayCount++;
          rooms[room].nightTime = false;
          rooms[room].hidden.actionCount = 0;
          rooms[room].hidden.actions = { mafia: {} };
        }
  
      } else {
        rooms[room].votes[target] = rooms[room].votes[target] ? rooms[room].votes[target]++ : 1;
        rooms[room].voteCount++;

        const roomStatus = { ...rooms[room] };
        io.to(room).emit('room_status', roomStatus);

        if (rooms[room].voteCount === rooms[room].aliveCount) {
          let killUser = undefined;
          Object.keys(rooms[room].votes).forEach(trgt => {
            if (!killUser || votes[trgt] > votes[killUser]) {
              killUser = trgt;
            }
          });
          
          const killUserIx = roomUsers[room].findIndex(user => user.name === killUser);
          if (rooms[room].hidden.roles[killUserIx] !== 'villager') { rooms[room].hidden.expectedActions--; }
          rooms[room].aliveCount--;
          rooms[room].message = `${killUser} was lynched by the village`;
          io.to(room).emit('room_users', [{ name: killUser, dead: true }]);
          
          rooms[room].nightTime = true;
          rooms[room].voteCount = 0;
          rooms[room].votes = {};
        }
      }

      const roomStatus = { ...rooms[room] };
      io.to(room).emit('room_status', roomStatus);
    });

    socket.on('new_message', (msg) => {
      socket.broadcast.to(room).emit('new_message', `${users[id]}: ${msg}`);
      console.log(`${id}: ${msg}`);
    });

    socket.on('disconnect', () => {
      if (rooms[room]) {
        roomUsers[room] = roomUsers[room].filter(us => us !== user);
      }

      io.to(room).emit('room_status', rooms[room]);
      io.emit('new_message', `${users[id]} disconnected`);
      delete users[id];
    });
  });

http.listen(4000, '0.0.0.0', () => {
  console.log('listening on *:4000');
});