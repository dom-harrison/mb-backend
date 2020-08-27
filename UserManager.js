const Room = require('./Room')

module.exports = function (db) {
  const MB_USERS = db.collection('mb-users');


  const addUser = async (name, socket) => {
    const newUserRef = MB_USERS.doc(name);  
    await newUserRef.set({
      name,
      'socketId': socket.id,
    });
  }

  const removeUser = async (name) => {
    await MB_USERS.doc(name).delete();
  }

  const getUsers = async () => {
    const snapshot = await MB_USERS.get();
    return !snapshot.empty && snapshot.docs.map((doc) => doc.data());
  }

  const getUserByName = async (name) => {
    let user;
    await MB_USERS.doc(name).get()
    .then(doc => {
      if (doc.exists) {
        user = doc.data();
      }
    });
    return user;
  }

  const getUserBySocket = async (socket) => {
    let user;
    await MB_USERS.where('socketId', '==', socket.id).get()
    .then(snapshot => {
      if (!snapshot.empty) {
        user = snapshot.docs[0].data();;
      }
    });
    return user;
  }

  return {
    addUser,
    removeUser,
    getUsers,
    getUserByName,
    getUserBySocket,
  }
}