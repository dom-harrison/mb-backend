module.exports = function (roomName) {
    const users = new Map()

    let status = {
        name: roomName,
        dayCount: 0,
        nightTime: false,
        message: '',
        votes: {},
        aliveCount: 0,
        gameOver: '',
        revote: {
            count: 0,
            users: []
        }
    };

    let hiddenStatus = {
        actions: { mafia: {} },
        actionCount: 0,
        mafia: 0,
        villager: 0,
        doctor: 0,
        policeman: 0,
    };

    let absentUsers = [];

    function addUser(name, socket) {
      const existingUser = getUserByName(name);

      if (existingUser) {
        delete existingUser.leaving;
        if (existingUser.socket && existingUser.socket.id !== socket.id) {
          removeUser(existingUser.socket);
          users.set(socket.id, { ...existingUser, name, socket });
        }
        const currentUserDetails = [{ ...existingUser, socket: undefined }];
        broadcastUsers(false, socket);
        broadcastUsersUpdate(currentUserDetails, socket);
        if (existingUser.role === 'mafia') {
          const mafiaUsers = Array.from(users.values())
            .filter(u => u.role === 'mafia' && u.name !== existingUser.name)
            .map(u => ({ name: u.name, role: 'mafia'}));
          broadcastUsersUpdate(mafiaUsers, socket);
        } else if (existingUser.role === 'policeman') {
          const investigatedUsers = Array.from(users.values())
            .filter(u => existingUser.investigated.includes(u.name))
            .map(u => ({ name: u.name, role: u.role }));
          broadcastUsersUpdate(investigatedUsers, socket);
        }
      } else {
        users.set(socket.id, { name, socket });
      }
      socket.join(roomName);
      socket.emit('room_status', status);
    }
    
    function removeUser(socket) {
      users.delete(socket.id);
      socket.leave(roomName);
    }

    function getUsers() {
      return users;
    }

    function getUserByName(name) {
      return Array.from(users.values()).find(us => us.name === name);
    }

    function setAbsentUser(name, role) {
      absentUsers.push({ name, role });
    }

    function getStatus() {
      return status;
    }

    function setStatus(update) {
      status = {
        ...status,
        ...update
      }
    }

    function getHiddenStatus() {
      return hiddenStatus;
    }

    function setHiddenStatus(update) {
      hiddenStatus = {
        ...hiddenStatus,
        ...update
      }
    }

    function broadcastStatus() {
      users.forEach(u => {
        if (!u.leaving) {
          u.socket.emit('room_status', status)
        }
      })
    }

    function broadcastUsers(roles, socket, sendAbsents) {
      const usersArray = Array.from(users.values()).map(u => {
        if (roles) {
          return ({ name: u.name, role: u.role || '', dead: u.dead || false});
        } else {
          return ({ name: u.name, dead: u.dead || false});
        };
      });
      if (socket) {
        socket.emit('room_users', usersArray);
      } else {
        users.forEach(u => u.socket.emit('room_users', usersArray))
      }
      if (sendAbsents) {
        users.forEach(u => u.socket.emit('room_users', absentUsers));
      }
    }

    function broadcastUsersUpdate(updatedUsers, socket) {
      if (socket) {
        socket.emit('room_users', updatedUsers);
      } else {
        users.forEach(u => u.socket.emit('room_users', updatedUsers));
      }
    }
  
    function serialize() {
      return {
        roomName,
        numMembers: users.size
      }
    }
  
    return {
      addUser,
      removeUser,
      getUsers,
      getUserByName,
      setAbsentUser,
      getStatus,
      setStatus,
      getHiddenStatus,
      setHiddenStatus,
      broadcastStatus,
      broadcastUsers,
      broadcastUsersUpdate,
      serialize
    }
  }