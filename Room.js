module.exports = function (roomName) {
    const users = new Map()

    let status = {
        name: roomName,
        dayCount: 0,
        nightTime: false,
        message: '',
        votes: {},
        aliveCount: 0,
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

    function addUser(name, socket) {
      users.set(socket.id, { name, socket })
      socket.join(roomName)
      socket.emit('room_status', status);
    }
    
    function removeUser(socket) {
      users.delete(socket.id)
    }

    function getUsers() {
      return users;
    }

    function getUserByName(name) {
      return Array.from(users.values()).find(us => us.name === name);
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
      users.forEach(u => u.socket.emit('room_status', status))
    }

    function broadcastUsers() {
      const usersArray = Array.from(users.values()).map(u => ({ ...u, socket: undefined }) );
      users.forEach(u => u.socket.emit('room_users', usersArray))
    }

    function broadcastUsersUpdate(updatedUsers, socket) {
      if (socket) {
        socket.emit('room_users', updatedUsers)
      } else {
        users.forEach(u => u.socket.emit('room_users', updatedUsers))
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