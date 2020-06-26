const roles = ['mafia', 'villager', 'doctor', 'policeman', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia']

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = function (io, socket, roomManager, userManager) {

  const handleConnection = () => {
    console.log('Connected-Socket:',socket.id);
    userManager.addUser(socket);
    roomManager.broadcastOpenRooms(io, socket);
  };

  const handleLogin = ({ name, roomName, reconnecting }) => {
    let room = roomManager.getRoomByName(roomName);
    if (reconnecting) {
      console.log('Reconnected-Socket:',socket.id, 'User:',name, 'Room:', roomName);
    } else {
      console.log('Login-Socket:',socket.id, 'User:',name, 'Room:',roomName);
    }

    if (!room) {
      if (reconnecting) {
        return socket.emit('connect_error', 'room-unavailable');
      }
      roomManager.addRoom(roomName);
      room = roomManager.getRoomByName(roomName);
      roomManager.broadcastOpenRooms(io);
    }

    if (room.getStatus().dayCount === 0 || reconnecting) {
      room.addUser(name, socket, reconnecting);
      if (room.getStatus().dayCount === 0) { room.broadcastUsers(); };
    } else {
      socket.emit('connect_error', 'game-started');
    }
  };

  const handleLeaveRoom = (submittedRoomName) => {
    const roomName = submittedRoomName || Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomManager.getRoomByName(roomName);
    const user = room && room.getUsers().get(socket.id);
    console.log('Leave-Socket:',socket.id, 'User:',user && user.name, 'Room:',roomName);

    if (room && room.getUsers().size > 0) {
      room.removeUser(socket);
      if (user && room.getStatus().dayCount > 0 && !room.getStatus().gameOver) {
        if (!user.dead) {
            user.dead = true;
            room.getHiddenStatus()[user.role]--;
            room.getStatus().aliveCount--;
            room.broadcastUsersUpdate([{ name: user.name, dead: true }]);
        }
      room.setAbsentUser(user.name, user.role);
      room.setStatus({message: `${user.name} left the game`});
      room.broadcastStatus();
      handleAction({ leaving: true });
      } else {
        room.broadcastUsersUpdate([{ name: user && user.name, remove: true }]);
      }
    }
    socket.leave(roomName);
    roomManager.broadcastOpenRooms(io, socket);
    if (room && room.getUsers().size === 0) {
        roomManager.removeRoom(roomName);
        console.log(roomName, 'is now closed');
        roomManager.broadcastOpenRooms(io);
    }
  };
  
      
  const handleStartGame = () => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomManager.getRoomByName(roomName);
    const users = room && room.getUsers();
    const usersArray = Array.from(users.values());

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
    roomManager.broadcastOpenRooms(io);
  };
  
  
  const handleAction = ({ target, role, leaving }) => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomManager.getRoomByName(roomName);

    if (room) {
      if (room.getStatus().nightTime) {
        const actions = room.getHiddenStatus().actions;

        if (!leaving) {
          room.getHiddenStatus().actionCount++;  
          switch (role) {
            case 'mafia':
              actions.mafia[target] = actions.mafia[target] ? actions.mafia[target] + 1 : 1;
              break;
            case 'policeman':
              const targetRole = room.getUserByName(target).role;
              room.broadcastUsersUpdate([{ name: target, role: targetRole }], socket);
              actions[role] = target;
              break;
            default:
              actions[role] = target;
          }
          room.broadcastStatus();
        }

        const { mafia, policeman, doctor } = room.getHiddenStatus();
        const mafiaActionCount = Object.values(actions.mafia).reduce((a, b) => a + b, 0);
        const policemanAction = policeman > 0 ? !!actions.policeman : true;
        const doctorAction = doctor > 0 ? !!actions.doctor : true;
        
        if (mafiaActionCount >= mafia && policemanAction && doctorAction) {
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

            if (killUserFull) {
              killUserFull.dead = true;
              room.getHiddenStatus()[killUserFull.role]--;
              room.getStatus().aliveCount--;
              room.broadcastUsersUpdate([{ name: killUser, dead: true }]);
            };

            room.setStatus({ message: `${killUser} was killed by the mafia` });
          }
          
          room.getStatus().dayCount++;
          room.setStatus({ nightTime: false })
          room.setHiddenStatus({ actionCount: 0, actions: { mafia: {} }});
        }

      } else if (!room.getStatus().nightTime) {
        const votes = room.getStatus().votes;

        if (!leaving) {
          votes[target] = votes[target] ? votes[target] + 1 : 1;
          room.broadcastStatus();
        }
        
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
            if (killUser) {
              killUser.dead = true;
              room.getHiddenStatus()[killUser.role]--;
              room.getStatus().aliveCount--;
            }

            room.setStatus({
              message: `${targetsWithMaxNumberOfVotes[0]} was lynched by the village`,
              nightTime: true,
              votes: {},
              revote: {
                count: 0,
                users: [],
              }
            })

            room.broadcastUsersUpdate([{ name: targetsWithMaxNumberOfVotes[0], dead: true }]);
          }
        }
      }
    
      const { mafia, villager, policeman, doctor } = room.getHiddenStatus();

      if (mafia === 0){
        room.setStatus({ message: 'Villagers win!', gameOver: true });
        room.broadcastUsers(roles, undefined, true);
      } else if (mafia > 0 && (villager + policeman + doctor < 2) ) {
        room.setStatus({ message: 'Mafia win!', gameOver: true });
        room.broadcastUsers(roles, undefined, true);
      }
      
      room.broadcastStatus();
    }
  };

  
  const handleDisconnected = (reason) => {
    console.log('Disconnected-Socket:',socket.id, 'Reason:',reason);
  };
  
  return {
    handleConnection,
    handleLogin,
    handleLeaveRoom,
    handleStartGame,
    handleAction,
    handleDisconnected,
  }
}