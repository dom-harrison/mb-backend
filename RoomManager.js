const Room = require('./Room')

module.exports = function () {
  const rooms = new Map();

  function addRoom(roomName) {
    rooms.set(roomName, Room(roomName));
  }

  function removeRoom(roomName) {
    rooms.delete(roomName);
  }

  function getRoomByName(roomName) {
    return rooms.get(roomName)
  }

  function broadcastOpenRooms(io, socket) {
    const roomsArray = Array.from(rooms.values()).filter(r => r.getStatus().dayCount === 0).map(r => r.getStatus().name);
    if (socket){
      socket.emit('open_rooms', roomsArray);
    } else {
      io.emit('open_rooms', roomsArray);
    }
  }

  function broadcastReconnectRoom(name, socket) {
    const reconnectRoom = Array.from(rooms.values()).find(r => r.getUserByName(name) && r.getUserByName(name).leaving && !r.getStatus().gameOver);
    if (reconnectRoom) {
      socket.emit('reconnect_room', reconnectRoom.getStatus().name);
    } else {
      socket.emit('reconnect_room');
    }
  }

  function serializeRooms() {
    return Array.from(chatrooms.values()).map(c => c.serialize())
  }

  return {
    addRoom,
    removeRoom,
    getRoomByName,
    broadcastOpenRooms,
    broadcastReconnectRoom,
    serializeRooms
  }
}