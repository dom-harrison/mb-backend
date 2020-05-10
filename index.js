var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const users = {};
const rooms = {};
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

    socket.on('login', ({ userName, roomName }) => {
      users[id] = userName;
      room = roomName;
      user = {
        name: userName,
        role: '',
        alive: true
      };

      socket.join(roomName);

      if (rooms[room]) {
        rooms[room].users = [...rooms[roomName].users, user];
      } else {
        rooms[room] = {
          name: room,
          users: [user],
          dayCount: 0,
          actions: { mafia: {} },
          actionCount: 0,
          expectedActions: 0,
        }
      }

      io.to(roomName).emit('room_status', rooms[room]);
    });

    socket.on('leave_room', () => {
      socket.leave(room);
      if (rooms[room]) {
        rooms[room].users = rooms[room].users.filter(us => us.name !== user.name);
      }
      io.to(room).emit('room_status', rooms[room]);
    });

    socket.on('start_game', () => {
      const gameRoles = shuffleArray(roles.slice(0, (rooms[room].users.length)));
      console.log(gameRoles);
      gameRoles.forEach((gameRole, ix) => {
        rooms[room].users[ix].role = gameRole;
        if (gameRole !== 'villager') {
          rooms[room].expectedActions ++
        }
      });
      rooms[room].dayCount = 1;
      rooms[room].nightTime = true
      io.to(room).emit('room_status', rooms[room]);
      user = rooms[room].users.find(us => us.name === user.name);
    });

    socket.on('action', (target) => {
      const actions = { ...rooms[room].actions };
      rooms[room].actionCount++;

      if (user.role === 'mafia') {
        actions.mafia = {
          ...actions.mafia,
          [target]: actions.mafia ? actions.mafia++ : 0
        }
      } else if (user.role === 'police') {
        io.to(id).emit('private_message', `${target} is... `);
      } else {
        actions[user.role] = target;
      }

      if (rooms[room].actionCount === rooms[room].expectedActions) {
        let killUser = undefined;
        let message = ''
        Object.keys(actions.mafia).forEach(act => {
          if (!killUser || actions.mafia[act] > actions.mafia[killUser]) {
            killUser = act;
          }
        })
        if (actions.doctor && actions.doctor === killUser) {
          rooms[room].message = `${killUser} was saved by the doctor`;
          killUser = undefined;
        } else {
          rooms[room].message = `${killUser} was killed by the mafia`;
        }
      }

      rooms[room].actions = actions;
      io.to(room).emit('room_status', rooms[room]);
    });

    socket.on('new_message', (msg) => {
      socket.broadcast.to(room).emit('new_message', `${users[id]}: ${msg}`);
      console.log(`${id}: ${msg}`);
    });

    socket.on('disconnect', () => {
      if (rooms[room]) {
        rooms[room].users = rooms[room].users.filter(us => us !== user);
      }

      io.to(room).emit('room_status', rooms[room]);
      io.emit('new_message', `${users[id]} disconnected`);
      delete users[id];
    });
  });

http.listen(3001, () => {
  console.log('listening on *:3001');
});