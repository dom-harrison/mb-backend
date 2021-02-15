const roles = ['mafia', 'villager', 'doctor', 'policeman', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia', 'villager', 'villager', 'villager', 'mafia']

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = function (socket, roomManager, userManager) {

  const handleConnection = () => {
    console.log('Connected:',socket.id);
    roomManager.broadcastOpenRooms(socket);
  };

  const handleLogin = async ({ userName, userId, reconnect, newName }) => {
    console.log('Login:', socket.id, 'Name:', userName );
    let loginId = userId;
    const user = await userManager.getUserByName(userName);

    if (user) {
      if (user.userId === loginId) {
        userManager.updateUser(userName, loginId, socket);
      } else {
        return socket.emit('login_response', { error: 'User already exists' });
      }      
    } else {
      if (loginId) {
        userManager.updateUser(userName, loginId, socket);
      } else {
        loginId = await userManager.addUser(userName, socket);
      }
    }

    if (newName) {
      socket.emit('login_response', { userName, userId: loginId });
    }

    if (!reconnect) {
      roomManager.broadcastRejoinRoom(userName, socket);
    }
    
  }

  const handleLogout = async (message) => {
    const roomExists = Object.keys(socket.rooms).find(room => room !== socket.id);
    if (roomExists) {
      handleLeaveRoom();
    }
    const socketExists = await userManager.getUserBySocket(socket.id);
    console.log('Logout:', socket.id, 'Name:', socketExists && socketExists.userName, 'Message:', message);
    if (socketExists) {
      userManager.removeUser(socketExists.userName);
    }
  }

  const handleJoinRoom = async ({ userName, roomName, rejoining }) => {
    let room = await roomManager.getRoomByName(roomName);
    if (rejoining) {
      console.log('RejoinRoom:',socket.id, 'User:',userName, 'Room:', roomName);
    } else {
      console.log('JoinRoom:',socket.id, 'User:',userName, 'Room:',roomName);
    }

    if (!room) {
      if (rejoining) {
        return socket.emit('connect_error', 'room-unavailable');
      }
      await roomManager.addRoom(roomName);
      room = await roomManager.getRoomByName(roomName);
      roomManager.broadcastOpenRooms();
    }

    const { status } = room.details;
    if (status.dayCount === 0 || rejoining) {
      room.addUser(userName, socket, rejoining);
    } else {
      socket.emit('connect_error', 'game-started');
    }
  };

  const handleLeaveRoom = async (message = '') => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = roomName && await roomManager.getRoomByName(roomName);
    const users = room && await room.getUsers();
    const user = users && users.find(us => us.socketId === socket.id);
    console.log('LeaveRoom:',socket.id, 'User:',user && user.userName, 'Room:',roomName, 'Message:', message);

    const status = room && room.details.status;

    if (room && users.length > 0) {
      if (user && status.dayCount > 0 && !status.gameOver) {
        room.updateUser(socket.id, { leaving: true });
        socket.leave(roomName)
        roomManager.broadcastRejoinRoom(user.userName, socket);

        setTimeout(async () => {
          const user = await room.getUserBySocket(socket.id);
          if (user.leaving) {
            room.removeUser(socket.id);
            roomManager.broadcastRejoinRoom(user.userName, socket, true);
            console.log('Leaving Room:', roomName, 'User:',user && user.userName);
            if (!user.dead) {
              room.setHiddenStatus(false, { field: user.role, amount: -1 });
              room.setStatus(false, { field: 'aliveCount', amount: -1 });
              room.broadcastUsersUpdate([{ userName: user.userName, dead: true }]);
            }
            room.setAbsentUser(socket.id, user.userName, user.role);
            await room.setStatus({'status.message': `${user.userName} left the game`});
            room.broadcastStatus();
            handleAction({ leaving: true, roomName });
            roomManager.broadcastOpenRooms(socket);

            if (!users || users.length === 1) {
              console.log(roomName, 'is now closed');
              await roomManager.removeRoom(roomName);
              roomManager.broadcastOpenRooms();
            }
          }
        }, 45000)

      } else {
        room.broadcastUsersUpdate([{ userName: user && user.userName, remove: true }]);
        roomManager.broadcastOpenRooms(socket);
        room.removeUser(socket.id);

        if (!users || users.length === 1) {
          console.log(roomName, 'is now closed');
          await roomManager.removeRoom(roomName);
          roomManager.broadcastOpenRooms();
        }
      }

    }
  };
      
  const handleStartGame = async () => {
    const roomName = Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = await roomManager.getRoomByName(roomName);
    const users = room && await room.getUsers();

    const gameRoles = shuffleArray(roles.slice(0, (users.length)));
    const mafiaUsers = []

    // Assign roles, send roles to non-mafia, create mafia array
    gameRoles.forEach(async (role, ix) => {
      room.updateUser(users[ix].socketId, { role });
      room.setHiddenStatus(false, {field: role, amount: 1});
      if (role !== 'mafia') {
        room.broadcastUsersUpdate([{ userName: users[ix].userName, role }], users[ix].socketId);
      } else {
        mafiaUsers.push({ userName: users[ix].userName, role })
      }
      if (role === 'policeman'){
        users[ix].investigated = [];
      }
    });

    // Send all mafia users to all mafia
    gameRoles.forEach((role, ix) => {
      if (role === 'mafia') {
        room.broadcastUsersUpdate(mafiaUsers, users[ix].socketId);
      }
    });

    await room.setStatus({ 'status.aliveCount': users.length, 'status.dayCount': 1, 'status.nightTime': true });
    room.broadcastStatus();
    roomManager.broadcastOpenRooms();
  };
  
  
  const handleAction = async ({ userName, target, role, leaving, roomName }) => {
    const actionRoomName = roomName || Object.keys(socket.rooms).find(room => room !== socket.id);
    const room = await roomManager.getRoomByName(actionRoomName);
    
    if (room) {
      const eventStamp = `${room.details.status.dayCount}${room.details.status.nightTime}${room.details.status.revote.count}`;
      room.broadcastUsersUpdate([{ userName: userName, previousEvent: eventStamp, previousTarget: target }], socket.id);

      if (room.details.status.nightTime) {
        if (!leaving) {
          switch (role) {
            case 'mafia':
              await room.setHiddenStatus(false, {field: `actions.mafia.${target}`, amount: 1});
              break;
            case 'policeman':
              const targetFull = await room.getUserByName(target);
              room.broadcastUsersUpdate([{ userName: target, role: targetFull.role }], socket.id);
              room.updateUser(socket.id, false, { field: 'investigated', value: target });
              await room.setHiddenStatus({ [`hiddenStatus.actions.${role}`]: target });
              break;
            case 'doctor':
              room.broadcastUsersUpdate([{ userName: userName, previousSaved: target }], socket.id);
              room.updateUser(socket.id, { previousSaved: target });
              await room.setHiddenStatus({ [`hiddenStatus.actions.${role}`]: target });
              break;
            default:
              await room.setHiddenStatus({ [`hiddenStatus.actions.${role}`]: target });
          }
          room.updateUser(socket.id, { previousEvent: eventStamp, previousTarget: target });
        }

        const hiddenStatus = await room.getDetails(true);
        const { mafia, policeman, doctor, actions } = hiddenStatus;
        const mafiaActionCount = Object.values(actions.mafia).reduce((a, b) => a + b, 0);
        const policemanAction = policeman > 0 ? !!actions.policeman : true;
        const doctorAction = doctor > 0 ? !!actions.doctor : true;
        console.log (`MAC: ${mafiaActionCount}, mafia: ${mafia}, police: ${policemanAction}, doctor:${doctorAction}`);
        
        if (mafiaActionCount >= mafia && policemanAction && doctorAction) {
          let message;
          let killUser = undefined;
          Object.keys(actions.mafia).forEach(trgt => {
            if (!killUser || actions.mafia[trgt] > actions.mafia[killUser]) {
              killUser = trgt;
            }
          })
          if (mafia > 1 && actions.mafia[killUser] < 2) {
            killUser = undefined;
            message = 'Mafia could not agree on who to kill';
          } else if (actions.doctor && actions.doctor === killUser) {
            message = `${killUser} was saved by the doctor`;
            killUser = undefined;
          } else {
            const killUserFull = killUser && await room.getUserByName(killUser);

            if (killUserFull) {
              room.updateUser(killUserFull.socketId, { dead: true });
              room.setStatus(false, {field: 'aliveCount', amount: -1});
              room.broadcastUsersUpdate([{ userName: killUser, dead: true }]);
              await room.setHiddenStatus(false, {field: killUserFull.role, amount: -1});
            };

            message = `${killUser} was killed by the mafia`;
          }
          
          await room.setStatus({ 'status.nightTime': false, 'status.message': message }, { field: 'dayCount', amount: 1 });
          await room.setHiddenStatus({ 'hiddenStatus.actions': { mafia: {} }});
        }

      } else if (!room.details.status.nightTime) {
        if (!leaving) {
          room.updateUser(socket.id, { previousEvent: eventStamp });
          await room.setStatus(false, {field: `votes.${target}`, amount: 1});
          room.broadcastStatus();
        }

        const status = await room.getDetails();
        const { votes, aliveCount } = status;
        const voteCount = votes ? Object.values(votes).reduce((a, b) => a + b, 0) : 0;
        if (voteCount >= aliveCount) {
          let maxNumberOfVotes = undefined;
          Object.keys(votes).forEach(target => {
            const numberOfVotesForTarget = votes[target];
            if (!maxNumberOfVotes || numberOfVotesForTarget > maxNumberOfVotes) {
              maxNumberOfVotes = numberOfVotesForTarget;
            }
          });

          const targetsWithMaxNumberOfVotes = Object.keys(votes).filter(target => votes[target] === maxNumberOfVotes);
          if (targetsWithMaxNumberOfVotes.length > 1) {
            await room.setStatus({
              'status.message': `Vote was a tie between ${targetsWithMaxNumberOfVotes.join(' and ')} - revote between them`,
              'status.votes': {},
              'status.revote': {
                users: targetsWithMaxNumberOfVotes
              },
            }, { field: 'revote.count', amount: 1 });
          } else {
            const killUser = await room.getUserByName(targetsWithMaxNumberOfVotes[0]);
            if (killUser) {
              room.updateUser(killUser.socketId, { dead: true });
              await room.setStatus(false, {field: 'aliveCount', amount: -1});
              await room.setHiddenStatus(false, {field: killUser.role, amount: -1});
            }

            await room.setStatus({
              'status.message': `${targetsWithMaxNumberOfVotes[0]} was lynched by the village`,
              'status.nightTime': true,
              'status.votes': {},
              'status.revote': {
                count: 0,
                users: [],
              }
            })

            room.broadcastUsersUpdate([{ userName: targetsWithMaxNumberOfVotes[0], dead: true }]);
          }
        }
      }
    
      const { mafia, villager, policeman, doctor } = await room.getDetails(true);

      if (mafia === 0){
        room.broadcastUsers(true, undefined, true);
        await room.setStatus({ 'status.message': 'Villagers win!', 'status.gameOver': true });
      } else if (mafia > 0 && (villager + policeman + doctor < 2) ) {
        room.broadcastUsers(true, undefined, true);
        await room.setStatus({ 'status.message': 'Mafia win!', 'status.gameOver': true });
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
    handleLogout,
    handleJoinRoom,
    handleLeaveRoom,
    handleStartGame,
    handleAction,
    handleDisconnected,
  }
}