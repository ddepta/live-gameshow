const app = require("express")();
const httpServer = require("http").createServer(app);
const { get } = require("http");
const jwt = require("jsonwebtoken");
const { send } = require("process");
const io = require("socket.io")(httpServer, {
  cors: { origin: "*" },
});

const port = 3000;
var buzzerState = [];
var lobbyCodes = [];
// username, lobbys + socketId array
var users = [];

// lobbycode, moderator, users[], isActive, currentBuzzerState, points, event history
var lobbys = [];

var tokenUser = {
  username: "",
  verified: false,
};

const SECRET_KEY = "your-secret-key";

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (token) {
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
      if (err) {
        console.error("Invalid token:", err);
        return next(new Error("Authentication error"));
      } else {
        console.log("Token verified. User:", decoded.username);
        tokenUser.username = decoded.username;
        tokenUser.verified = true;
        //updateSocketIdForUserFromJwt(socket, decoded.username);
        return next();
      }
    });
  } else {
    console.error("No token provided");
    return next();
  }
});

io.on("connection", (socket) => {
  console.log("a user connected");

  //   lobby zum 1. mal betreten (lobby join)
  // (username prüfen)
  // überprüfen, ob lobbycode gültig

  // einer bestehenden Lobby beitreten (lobby join)
  // (username prüfen)
  // überprüfen, ob lobbycode gültig

  // lobby neuladen

  // send the current state of the lobby (buzzer) to a new user / to a reconnecting user
  // lobbycode required

  // TODO: get username from client-cookie and search for the user in the users-array
  // if the user has a matching lobbycode, redirect him to the lobby

  // const currentState = buzzerState.find(
  //   ({ lobbycode }) => lobbycode === "ASDCF"
  // );
  // if (currentState) {
  //   io.to(socket.id).emit(currentState.action, currentState.socketId);
  // }

  socket.on("message", (message) => {
    //emitMessage(lobbyCode, "message", message);
    // TODO: send message to curernt lobby
    io.emit("message", `${socket.id.substr(0, 2)}: ${message}`);
  });

  socket.on("lobby:join", (lobbyCode, username, callback) => {
    console.log("lobby:joined");
    var validUsername = handleUsername(username, callback);

    if (validUsername) {
      var token = jwt.sign({ username: username }, SECRET_KEY);
      lobbyCode = handleLobby(lobbyCode, username, callback);

      if (lobbyCode) {
        callback({ lobbyCode: lobbyCode, token: token, username: username });
        emitMessage(lobbyCode, "lobby:joined", username + " joined the lobby");
      }
    }
  });

  socket.on("lobby:get", (lobbyCode, callback) => {
    console.log("lobby:get");
    console.log(socket.username);
    var isLobbyCodeValid = lobbys.some(
      (lobby) => lobby.lobbyCode === lobbyCode
    );

    if (isLobbyCodeValid) {
      updateSocketIdForUserFromJwt(lobbyCode);
      var result = getLobby(lobbyCode, socket.username);
      generateLobbyEnterLeaveEvent(lobbyCode, socket.username, "joined");
      callback(result);
    } else {
      callback({ error: "Invalid Lobby Code" });
    }
  });

  socket.on("buzzer:pressed", (lobbyCode) => {
    console.log("buzzer:pressed");
    buzzerStateChanged("buzzer:pressed", lobbyCode);
  });

  // TODO: check if lobby-moderator
  socket.on("buzzer:reset", (lobbyCode) => {
    buzzerStateChanged("buzzer:reset", lobbyCode);
  });

  socket.on("buzzer:locked", (lobbyCode) => {
    // Check if user is moderator before allowing lock
    var foundUser = findUserBySocketId(socket.id);
    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        buzzerStateChanged("buzzer:locked", lobbyCode);
      }
    }
  });

  socket.on("disconnect", () => {
    var simplifiedUser = findSimplifiedUserBySocketId(socket.id);
    if (simplifiedUser) {
      addEventToLobbyEventHistory(
        simplifiedUser.lobbyCode,
        "lobby:user:left",
        simplifiedUser.username,
        ""
      );
    }
    console.log("a user disconnected!");
  });

  function sendCurrentBuzzerState(lobbyCode) {
    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (lobby?.currentBuzzerState) {
      emitMessage(
        lobbyCode,
        lobby?.currentBuzzerState.action,
        lobby?.currentBuzzerState.username
      );
    }
  }

  function handleUsername(username, callback) {
    if (username) {
      if (username.length > 0) {
        if (users.includes(username)) {
          callback({ error: "Username already taken" });
          return false;
        } else {
          return true;
        }
      }
    }

    callback({ error: "Invalid Username" });
    return false;
  }

  function handleLobby(lobbyCode, username, callback) {
    // if the lobby code is empty, a new lobby code is generated and the user joins the lobby
    // if the lobby code is not empty, check if the lobby code exists
    // if the lobby code exists, the user joins the lobby
    if (lobbyCode) {
      console.log("handleLobby lobbycode", lobbyCode, username);
      if (lobbys.some((lobby) => lobby.lobbyCode === lobbyCode)) {
        console.log("handleLobby lobby found", lobbyCode, username);
        // TODO: check if lobby is closed/full
        addUser(lobbyCode, username);
        addUserToLobby(lobbyCode, username);
        socket.join(lobbyCode);
        sendCurrentBuzzerState(lobbyCode);
      } else {
        callback({ error: "Invalid Lobby Code" });
        return null;
      }
    } else {
      console.log("handleLobby new code", lobbyCode, username);
      lobbyCode = generateLobbyCode();

      currentBuzzerState = { action: "", socketId: "", username: "", data: "" };

      var moderator = { socketId: socket.id, username: username };
      var lobby = {
        lobbyCode: lobbyCode,
        moderator: moderator,
        users: [],
        isActive: true,
        currentBuzzerState: currentBuzzerState,
        eventHistory: [currentBuzzerState],
      };

      lobbys.push(lobby);
      addUser(lobbyCode, username);
      socket.join(lobbyCode);
    }
    return lobbyCode;
  }

  function addUser(lobbyCode, username) {
    var lobbys = [];
    lobbys.push({ lobbyCode: lobbyCode, socketId: socket.id });

    console.log("addUser", username, lobbys);

    const userIndex = users.findIndex((user) => user.username === username);

    if (userIndex != -1) {
      users[userIndex].lobbys.push({
        lobbyCode: lobbyCode,
        socketId: socket.id,
      });
      users[userIndex].username = username;
    } else {
      users.push({
        username: username,
        lobbys: lobbys,
      });
    }
  }

  function addUserToLobby(lobbyCode, username) {
    console.log("addUserToLobby", lobbyCode, username);
    const lobbyIndex = lobbys.findIndex(
      (lobby) => lobby.lobbyCode === lobbyCode
    );

    if (lobbyIndex != -1) {
      lobbys[lobbyIndex].users.push({
        socketId: socket.id,
        username: username,
      });

      addEventToLobbyEventHistory(lobbyCode, "lobby:user:joined", username, "");
    }
  }

  function removeUserFromLobby(lobbyCode, username) {
    const lobbyIndex = lobbys.findIndex(
      (lobby) => lobby.lobbyCode === lobbyCode
    );

    if (lobbyIndex != -1) {
      const userIndex = lobbys[lobbyIndex].users.findIndex(
        (user) => user.username === username
      );

      if (userIndex != -1) {
        lobbys[lobbyIndex].users.splice(userIndex, 1);
      }
    }
  }

  function generateLobbyEnterLeaveEvent(lobbyCode, username, shortAction) {
    var lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    var action = "";

    if (lobby) {
      if (lobby.moderator.username === username) {
        action = "lobby:moderator:" + shortAction;
      } else {
        action = "lobby:user:" + shortAction;
      }
      addEventToLobbyEventHistory(lobbyCode, action, username, "");
    }
  }

  function addEventToLobbyEventHistory(lobbyCode, action, username, data) {
    const lobbyIndex = lobbys.findIndex(
      (lobby) => lobby.lobbyCode === lobbyCode
    );

    if (lobbyIndex != -1) {
      lobbys[lobbyIndex].eventHistory.push({
        action: action,
        socketId: socket.id,
        username: username,
        data: data,
      });
    }
  }

  function getLobby(lobbyCode, username) {
    var user = users.find((user) => user.username === username);
    console.log("user", user);
    console.log("username", username);
    if (user.lobbys.some((lobby) => lobby.lobbyCode === lobbyCode)) {
      socket.join(lobbyCode);
      sendCurrentBuzzerState(lobbyCode);

      // Get the lobby
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);

      // Check if the user is the moderator
      const isModerator = lobby.moderator.username === username;

      // Add moderator status to the response
      return { ...lobby, isModerator };
    }

    return { error: "No access to lobby" };
  }

  function emitMessage(recipient, event, data) {
    console.log("emitMessage", recipient, event, data);
    io.to(recipient).emit(event, data);
  }

  function buzzerStateChanged(action, lobbyCode) {
    var foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      console.log("buzzerStateChanged", action, lobbyCode, foundUser);

      const index = lobbys.findIndex((lobby) => lobby.lobbyCode === lobbyCode);

      currentBuzzerState = {
        action: action,
        socketId: socket.id,
        username: foundUser.username,
        data: "",
      };
      lobbys[index].currentBuzzerState = currentBuzzerState;
      addEventToLobbyEventHistory(lobbyCode, action, foundUser.username, "");

      emitMessage(lobbyCode, action, foundUser.username);
    } else {
      console.log(
        "buzzerStateChanged",
        "user not found, socketId: ",
        socket.id
      );
    }
  }

  function updateSocketIdForUserFromJwt(lobbyCode) {
    if (tokenUser.verified) {
      socket.username = tokenUser.username;
      console.log("update users: ", users);
      if (users.find((user) => user.username === tokenUser.username)) {
        const userIndex = users.findIndex(
          (user) => user.username === tokenUser.username
        );

        if (userIndex != -1) {
          console.log("updateSocket", users[userIndex]);
          var lobbyIndex = users[userIndex].lobbys.findIndex(
            (lobby) => lobby.lobbyCode === lobbyCode
          );
          if (lobbyIndex != -1) {
            users[userIndex].lobbys[lobbyIndex].socketId = socket.id;
          }
        }
      }
    }
  }
});

function findUserBySocketId(socketId) {
  for (const user of users) {
    const foundLobby = user.lobbys.find((lobby) => lobby.socketId === socketId);
    if (foundLobby) {
      return user;
    }
  }
  return null;
}

function findSimplifiedUserBySocketId(socketId) {
  for (const user of users) {
    const foundLobby = user.lobbys.find((lobby) => lobby.socketId === socketId);
    if (foundLobby) {
      var result = {
        username: user.username,
        socketId: socketId,
        lobbyCode: foundLobby.lobbyCode,
      };
      return result;
    }
  }
  return null;
}

function findUserLobbyIndexBySocketId(socketId) {
  for (const user of users) {
    const foundLobby = user.lobbys.findIndex(
      (lobby) => lobby.socketId === socketId
    );
    if (foundLobby) {
      return foundLobby;
    }
  }
  return null;
}

function generateLobbyCode() {
  const possibles = "ABCDEFGHKMNPQRSTUVWXYZ";
  let codeLength = 5;
  let lobbyCode = "";
  let tries = 0;

  do {
    do {
      lobbyCode = "";
      for (let i = 0; i < codeLength; i++) {
        const randomIndex = Math.floor(Math.random() * possibles.length);
        lobbyCode += possibles[randomIndex];
      }

      tries++;
    } while (
      lobbys.some((lobby) => lobby.lobbyCode === lobbyCode) ||
      tries < 10
    );

    if (tries == 10) {
      codeLength++;
      tries = 0;
    }
  } while (lobbys.some((lobby) => lobby.lobbyCode === lobbyCode));

  return lobbyCode;
}

httpServer.listen(port, () => console.log(`listening on port ${port}`));
