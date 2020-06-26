const Room = require('./Room')

module.exports = function () {
  const users = new Map();

  function addUser(socket) {
    users.set(socket.id, socket)
  }
  
  function removeUser(socket) {
    users.delete(socket.id)
  }

  function getUsers() {
    return users;
  }

  return {
    addUser,
    removeUser,
    getUsers,
  }
}