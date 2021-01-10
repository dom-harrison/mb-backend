const Room = require('./Room')

module.exports = function (db, io) {
  const MB_ROOMS = db.collection('mb-rooms');
  const MB_ROOMS_USERS = db.collectionGroup('roomUsers');

  const addRoom = async (roomName) => {
    const newRoomRef = MB_ROOMS.doc(roomName);  
    await newRoomRef.set({
      status: {
        roomName,
        dayCount: 0,
        nightTime: false,
        message: '',
        votes: {},
        aliveCount: 0,
        gameOver: false,
        revote: {
          count: 0,
          users: []
        }
      },
      hiddenStatus: {
        actions: { mafia: {} },
        mafia: 0,
        villager: 0,
        doctor: 0,
        policeman: 0,
      },
    });
  };

  const removeRoom = async (roomName) => {
    await MB_ROOMS.doc(roomName).delete();
  };

  const getRoomByName = async (roomName) => {
    let room;
    const doc = await MB_ROOMS.doc(roomName).get()
    if (doc.exists) {
      const details = doc.data();
      room = Room(roomName, details, db, io);
    }
    return room;
  };

  const broadcastOpenRooms = async (socket) => {
    let roomsArray = [];
    const snapshot = await MB_ROOMS.where('status.dayCount', '==', 0).get()
    if (!snapshot.empty) {
      roomsArray = snapshot.docs.map((doc) => doc.id);
    }
    if (socket){
      socket.emit('open_rooms', roomsArray);
    } else {
      io.emit('open_rooms', roomsArray);
    }
  };

  const broadcastRejoinRoom = async (userName, socket, leftRoom) => {
    if (leftRoom) {
      return socket.emit('rejoin_room');
    }
    let parentId;
    let rejoinRoom;
    const snapshot = await MB_ROOMS_USERS.where('userName', '==', userName).get();
    if (!snapshot.empty) {
      parentId = snapshot.docs[0].ref.parent.parent.id;
    }

    if (parentId) {
      const doc = await MB_ROOMS.doc(parentId).get()
      if (doc.exists && !doc.data().status.gameOver) {
      rejoinRoom = doc.id;
      }
    }

    if (rejoinRoom) {
      socket.emit('rejoin_room', rejoinRoom);
    } else {
      socket.emit('rejoin_room');
    }
  };

  return {
    addRoom,
    removeRoom,
    getRoomByName,
    broadcastOpenRooms,
    broadcastRejoinRoom,
  }
}