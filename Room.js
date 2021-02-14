const admin = require('firebase-admin');

module.exports = function (roomName, details, db, io) {
  const MB_ROOM = db.collection('mb-rooms').doc(roomName);
  const MB_ROOM_USERS = MB_ROOM.collection('roomUsers');
  const MB_ABSENT_USERS = MB_ROOM.collection('absentUsers');

    const addUser = async (userName, socket, rejoining) => {
      const { status } = details;
      socket.emit('room_status', status);

      if (!rejoining) {
        socket.join(roomName);
        broadcastUsersUpdate([{userName}]);
        await MB_ROOM_USERS.doc(socket.id).set({ userName, socketId: socket.id });
        broadcastUsers(false);
      } else {
        const existingUser = await getUserByName(userName);
        if (existingUser) {
          if (existingUser.socketId !== socket.id) {
            removeUser(existingUser.socketId);
            
            MB_ROOM_USERS.doc(socket.id).set({ ...existingUser, userName, socketId: socket.id, leaving: false });
          } else {
            await updateUser(socket.id, { leaving: false });
          }
          socket.join(roomName);
          const currentUserDetails = [{ ...existingUser, socket: undefined, leaving: false }];
        broadcastUsers(false, socket);
          broadcastUsersUpdate(currentUserDetails, socket.id);
  
          if (existingUser.role === 'mafia') {
            const users = await getUsers();
            const mafiaUsers = users.filter(u => u.role === 'mafia' && u.userName !== existingUser.userName)
              .map(u => ({ userName: u.userName, role: 'mafia'}));
            broadcastUsersUpdate(mafiaUsers, socket.id);
          } else if (existingUser.role === 'policeman') {
            const users = await getUsers();
            const investigatedUsers = users.filter(u => (existingUser.investigated || []).includes(u.userName))
              .map(u => ({ userName: u.userName, role: u.role }));
            broadcastUsersUpdate(investigatedUsers, socket.id);
          }
        } else {
          return socket.emit('connect_error', 'game-started');
        }
      }
    }
    
    const removeUser = async (socketId) => {
      await MB_ROOM_USERS.doc(socketId).delete();
      const fullSocket = io.sockets.connected[socketId];
      if (fullSocket) { fullSocket.leave(roomName) };
    }

    const getUsers = async () => {
      const snapshot = await MB_ROOM_USERS.get();
      if (!snapshot.empty) {
        return !snapshot.empty && snapshot.docs.map((doc) => doc.data());
      }
      return [];
    }

    const getUserBySocket = async (socketId) => {
      const doc = await MB_ROOM_USERS.doc(socketId).get();
      return doc.exists && doc.data();
    }

    const getUserByName = async (userName) => {
      const snapshot = await MB_ROOM_USERS.where('userName', '==', userName).get();
      return !snapshot.empty && snapshot.docs[0].data();
    }

    const updateUser = async (socketId, change, array) => {
      if (array) {
        await MB_ROOM_USERS.doc(socketId).update({ [array.field]: admin.firestore.FieldValue.arrayUnion(array.value) });
      } else {
        await MB_ROOM_USERS.doc(socketId).update(change);
      }
    }

    const setAbsentUser = async (socketId, userName, role) => {
      await MB_ABSENT_USERS.doc(socketId).set({ userName, role });
    }

    const getAbsentUsers = async () => {
      const snapshot = await MB_ABSENT_USERS.get();
      if (!snapshot.empty) {
        return !snapshot.empty && snapshot.docs.map((doc) => doc.data());
      }
      return [];
    }

    const getDetails = async (hidden) => {
      const doc = await MB_ROOM.get();
      let details;
      if (doc.exists) {
        details = doc.data();
      }
      return hidden ? details.hiddenStatus : details.status;
    }

    const setStatus = async (changes, increment) => {
      if (changes) {
        return await MB_ROOM.update(changes);
      }
      if (increment) {
        return await MB_ROOM.update({ [`status.${increment.field}`]: admin.firestore.FieldValue.increment(increment.amount) });
      }
    }

    const setHiddenStatus = async (changes, increment) => {
      if (changes) {
        return await MB_ROOM.update(changes);
      }
      if (increment) {
        return await MB_ROOM.update({ [`hiddenStatus.${increment.field}`]: admin.firestore.FieldValue.increment(increment.amount) });
      } 
    }

    const broadcastStatus = async () => {
      const status = await getDetails();
      io.in(roomName).emit('room_status', status);
    }

    const broadcastUsers = async (roles, socket, sendAbsents) => {
      const users = await getUsers();
      const usersArray = (users || []).map((u, index) => {
        return ({ 
          userName: u.userName, 
          role: roles ? u.role : undefined, 
          dead: u.dead || false,
          host: index === 0,
        }) 
      });
      if (socket) {
        socket.emit('room_users', usersArray);
      } else {
        io.in(roomName).emit('room_users', usersArray);
      }
      if (sendAbsents) {
        const absentUsers = await getAbsentUsers();
        io.in(roomName).emit('room_users', absentUsers);
      }
    }

    const broadcastUsersUpdate = (updatedUsers, socketId) => {
      if (socketId) {
        const socket = io.sockets.connected[socketId];
        if (socket) {
          socket.emit('room_users', updatedUsers);
        }
      } else {
        io.in(roomName).emit('room_users', updatedUsers);
      }
    }


    return {
      details,
      addUser,
      removeUser,
      getUsers,
      getUserBySocket,
      getUserByName,
      updateUser,
      setAbsentUser,
      getDetails,
      setStatus,
      setHiddenStatus,
      broadcastStatus,
      broadcastUsers,
      broadcastUsersUpdate,
    }
  }