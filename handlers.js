const roles = ['mafia', 'villager', 'doctor', 'policeman', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia']

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = function (socket, roomManager) {
    
  const handleLogin = ({ name, roomName }) => {
    let room = roomManager.getRoomByName(roomName);
    if (!room) { 
      roomManager.addRoom(roomName);
      room = roomManager.getRoomByName(roomName);
    }

    if (room.getStatus().dayCount === 0) {
      room.addUser(name, socket);
      room.broadcastUsers();
    } else {
      socket.emit('message', 'Game started');
    }
  };

  
  const handleLeaveRoom = (roomName) => {
    const room = roomManager.getRoomByName(roomName);
    const user = room && room.getUsers().get(socket.id);
    if (room && room.getUsers().size > 0) {
        if (room.getStatus().dayCount > 0){  
        if (user && !user.dead) {
            user.dead = true;
            room.getHiddenStatus()[user.role]--;
            room.getStatus().aliveCount--;
            room.broadcastUsersUpdate([{ name: user.name, dead: true }]);
        }
        room.setStatus({message: `${user.name} left the game`});
        room.broadcastStatus();
        } else {
        room.broadcastUsersUpdate([{ name: user.name, remove: true }]);
        }
        room.removeUser(socket);
    }
    socket.leave(roomName);
    if (room && room.getUsers().size === 0) { 
        roomManager.removeRoom(roomName)
    }
  };
  
      
  const handleStartGame = () => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomManager.getRoomByName(roomName);
    const users = room.getUsers();
    const usersArray = Array.from(users.values())

    const gameRoles = shuffleArray(roles.slice(0, (users.size)));
    const mafiaUsers = []

    // Assign roles, send roles to non-mafia, create mafia array
    gameRoles.forEach((role, ix) => {
      usersArray[ix].role = role;
      room.getHiddenStatus()[role]++;
      if (role !== 'mafia') {
        room.broadcastUsersUpdate([{ name: usersArray[ix].name, role }], usersArray[ix].socket);
      } else {
        mafiaUsers.push({ name: usersArray[ix].name, role })
      }
    });

    // Send all mafia users to all mafia
    gameRoles.forEach((role, ix) => {
      if (role === 'mafia') {
        room.broadcastUsersUpdate(mafiaUsers, usersArray[ix].socket);
      }
    });

    room.setStatus({aliveCount: users.size, dayCount: 1, nightTime: true});
    room.broadcastStatus();
  };
  
  
  const handleAction = ({ target, role }) => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomManager.getRoomByName(roomName);

    if (room && room.getStatus().nightTime) {
      const { mafia, policeman, doctor } = room.getHiddenStatus();
      const expectedActions = mafia + policeman + doctor;
      const actions = room.getHiddenStatus().actions;
      room.getHiddenStatus().actionCount++;

      if (role === 'mafia') {
        actions.mafia[target] = actions.mafia[target] ? actions.mafia[target] + 1 : 1;
      } else if (role === 'policeman') {
        const targetRole = room.getUserByName(target).role;
        room.broadcastUsersUpdate([{ name: target, role: targetRole }], socket);
      } else {
        actions[role] = target;
      }

      room.broadcastStatus();
      
      if (room.getHiddenStatus().actionCount === expectedActions) {
        let killUser = undefined;
        Object.keys(actions.mafia).forEach(trgt => {
          if (!killUser || actions.mafia[trgt] > actions.mafia[killUser]) {
            killUser = trgt;
          }
        })
        if (room.getHiddenStatus().mafia > 1 && actions.mafia[killUser] < 2) {
          killUser = undefined;
          room.setStatus({ message: 'Mafia could not agree on who to kill' });
        } else if (actions.doctor && actions.doctor === killUser) {
          room.setStatus({ message: `${killUser} was saved by the doctor` });
          killUser = undefined;
        } else {
          const killUserFull = room.getUserByName(killUser);
          killUserFull.dead = true;
          room.getHiddenStatus()[killUserFull.role]--;
          room.getStatus().aliveCount--;
          room.setStatus({ message: `${killUser} was killed by the mafia` });
          room.broadcastUsersUpdate([{ name: killUser, dead: true }]);
        }
        
        room.getStatus().dayCount++;
        room.setStatus({ nightTime: false })
        room.setHiddenStatus({ actionCount: 0, actions: { mafia: {} }});
      }

    } else if (room && !room.getStatus().nightTime) {
      const votes = room.getStatus().votes;
      votes[target] = votes[target] ? votes[target] + 1 : 1;      
      room.broadcastStatus();

      const voteCount = votes ? Object.values(votes).reduce((a, b) => a + b, 0) : 0;
      if (voteCount === room.getStatus().aliveCount) {
        let maxNumberOfVotes = undefined;
        Object.keys(votes).forEach(target => {
          const numberOfVotesForTarget = votes[target];
          if (!maxNumberOfVotes || numberOfVotesForTarget > maxNumberOfVotes) {
            maxNumberOfVotes = numberOfVotesForTarget;
          }
        });

        const targetsWithMaxNumberOfVotes = Object.keys(votes).filter(target => votes[target] === maxNumberOfVotes);
        if (targetsWithMaxNumberOfVotes.length > 1) {
          room.setStatus({
            message: `Vote was a tie between ${targetsWithMaxNumberOfVotes.join(' and ')} - revote between them`,
            votes: {},
            revote: {
              count: room.getStatus().revote.count + 1,
              users: targetsWithMaxNumberOfVotes
            },
          });
        } else {
          const killUser = room.getUserByName(targetsWithMaxNumberOfVotes[0]);
          killUser.dead = true;
          room.getHiddenStatus()[killUser.role]--;
          room.getStatus().aliveCount--;

          room.setStatus({
            message: `${killUser.name} was lynched by the village`,
            nightTime: true,
            votes: {},
            revote: {
              count: 0,
              users: [],
            }
          })

          room.broadcastUsersUpdate([{ name: killUser.name, dead: true }]);
        }
      }
    }
  
    const { mafia, villager, policeman, doctor } = room.getHiddenStatus();

    if (mafia === 0){
      room.setStatus({ message: 'Villagers win!', gameOver: true });
      room.broadcastUsers();
    } else if (mafia > 0 && (villager + policeman + doctor < 2) ) {
      room.setStatus({ message: 'Mafia win!', gameOver: true });
      room.broadcastUsers();
    }

    room.broadcastStatus();
  };

  
  const handleDisconnecting = (reason) => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomManager.getRoomByName(roomName);
    const user = room && room.getUsers().get(socket.id);
    console.log('User:', user.name, 'Disconnect reason:', reason);
    if (room) {
      if (room.getStatus().dayCount > 0) {
        if (!user.dead) {
          user.dead = true;
          room.getHiddenStatus()[user.role]--;
          room.getStatus().aliveCount--;
          room.broadcastUsersUpdate([{ name: user.name, dead: true }]);
        }
        room.setStatus({message: `${user.name} left the game`});
        room.broadcastStatus();
      } else {
        room.broadcastUsersUpdate([{ name: user.name, remove: true }]);
      }
    }
    if (room && room.getUsers().size === 0) { 
      roomManager.removeRoom(roomName)
    }
  };
  
  return { 
    handleLogin,
    handleLeaveRoom,
    handleStartGame,
    handleAction,
    handleDisconnecting,
  }
}