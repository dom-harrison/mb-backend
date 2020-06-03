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

  function serializeRooms() {
    return Array.from(chatrooms.values()).map(c => c.serialize())
  }

  return {
    addRoom,
    removeRoom,
    getRoomByName,
    serializeRooms
  }
}