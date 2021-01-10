const Room = require('./Room')

module.exports = function (db) {
  const MB_USERS = db.collection('mb-users');

  const addUser = async (userName, socket) => {
    const res = await MB_USERS.add({
      userName,
      'socketId': socket.id,
    });
    return res.id;
  }

  const updateUser = async (userName, id, socket) => {
    const newUserRef = MB_USERS.doc(id);  
    await newUserRef.set({
      userName,
      'socketId': socket.id,
    });
  }

  const removeUser = async (userName) => {
    await MB_USERS.doc(userName).delete();
  }

  const getUsers = async () => {
    const snapshot = await MB_USERS.get();
    return !snapshot.empty && snapshot.docs.map((doc) => doc.data());
  }

  const getUserByName = async (userName) => {
    let user;
    const snapshot = await MB_USERS.where('userName', '==', userName).get()
    if (!snapshot.empty) {
      user = snapshot.docs[0].data();
      user.userId = snapshot.docs[0].id;
    }
    return user;
  }

  const getUserBySocket = async (socketId) => {
    let user;
    const snapshot = await MB_USERS.where('socketId', '==', socketId).get()
    if (!snapshot.empty) {
      user = snapshot.docs[0].data();
    }
    return user;
  }

  return {
    addUser,
    updateUser,
    removeUser,
    getUsers,
    getUserByName,
    getUserBySocket,
  }
}