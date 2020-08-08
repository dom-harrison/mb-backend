const Room = require('./Room')

module.exports = function () {
  const users = new Map();

  function addUser(name, socket) {
    users.set(name, { name, socket })
  }
  
  function removeUser(name) {
    users.delete(name)
  }

  function getUsers() {
    return users;
  }

  function getUserByName(name) {
    return users.get(name);
  }

  function getUserBySocket(socket) {
    const userArray = Array.from(users.values());
    return userArray.find(us => us.socket.id === socket.id)
  }

  return {
    addUser,
    removeUser,
    getUsers,
    getUserByName,
    getUserBySocket,
  }
}