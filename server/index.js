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

const SECRET_KEY = "your-secret-key";

// Add this helper function outside the socket connection for token verification
function verifyAndProcessToken(socket, token) {
  // Initialize result object
  let result = {
    success: false,
    username: "",
  };

  // Check if token is valid string
  if (
    !(
      token &&
      typeof token === "string" &&
      token.trim().length > 0 &&
      token !== "undefined" &&
      token !== "null"
    )
  ) {
    console.log("Invalid token format:", token);
    return result;
  }

  try {
    // Synchronous verification to make this function simpler to use
    const decoded = jwt.verify(token, SECRET_KEY);

    if (decoded && decoded.username) {
      // Store auth data on socket
      socket.auth = socket.auth || {}; // Create auth object if it doesn't exist
      socket.auth.username = decoded.username;
      socket.auth.verified = true;
      socket.username = decoded.username; // For backward compatibility

      console.log("Token successfully verified for:", decoded.username);

      result.success = true;
      result.username = decoded.username;
      return result;
    }
  } catch (err) {
    console.error("Token verification failed:", err.message);
  }

  return result;
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log("Connection token:", token);

  // Initialize auth data on socket object
  socket.auth = {
    username: "",
    verified: false,
  };

  if (token) {
    // Use the new helper function
    const verification = verifyAndProcessToken(socket, token);
    if (verification.success) {
      return next();
    }
  }

  console.error("No valid token provided or verification failed");
  return next(); // Allow connection, but with unverified status
});

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("message", (message) => {
    io.emit("message", `${socket.id.substr(0, 2)}: ${message}`);
  });

  socket.on("lobby:join", (lobbyCode, username, callback) => {
    console.log("lobby:joined");
    var validUsername = handleUsername(username, callback);

    if (validUsername) {
      var token = jwt.sign({ username: username }, SECRET_KEY);

      // Use the helper function for consistent verification
      verifyAndProcessToken(socket, token);

      console.log("lobby:join token signed: ", token);
      lobbyCode = handleLobby(lobbyCode, username, callback);

      if (lobbyCode) {
        callback({ lobbyCode: lobbyCode, token: token, username: username });
        emitMessage(lobbyCode, "lobby:joined", username + " joined the lobby");
      }
    }
  });

  socket.on("lobby:get", (lobbyCode, callback) => {
    console.log("lobby:get for lobby:", lobbyCode);

    // First, verify the current token again to ensure auth data is updated
    const token = socket.handshake.auth.token;
    if (token) {
      verifyAndProcessToken(socket, token);
    }

    console.log("Socket auth status after verification:", socket.auth);

    // Check if the lobby exists
    var isLobbyCodeValid = lobbys.some(
      (lobby) => lobby.lobbyCode === lobbyCode
    );

    if (!isLobbyCodeValid) {
      console.log("Invalid lobby code:", lobbyCode);
      callback({ error: "Invalid Lobby Code" });
      return;
    }

    // Make sure user is authenticated
    if (!socket.auth || !socket.auth.verified) {
      console.log("User not authenticated, denying access");
      callback({ error: "Authentication required" });
      return;
    }

    console.log("lobby:get lobby found", lobbyCode, socket.auth.username);
    const wasReconnect = updateSocketIdForUserFromJwt(lobbyCode, socket);
    var result = getLobby(lobbyCode, socket.auth.username, socket);

    if (!result.error) {
      // Only generate join event if this was a reconnection
      if (wasReconnect) {
        generateLobbyEnterLeaveEvent(lobbyCode, socket.auth.username, "joined");
        emitMessage(
          lobbyCode,
          "lobby:joined",
          socket.auth.username + " reconnected"
        );
      }
    }

    callback(result);
  });

  socket.on("buzzer:pressed", (lobbyCode) => {
    console.log("buzzer:pressed");
    buzzerStateChanged("buzzer:pressed", lobbyCode);
  });

  socket.on("buzzer:reset", (lobbyCode) => {
    buzzerStateChanged("buzzer:reset", lobbyCode);
  });

  socket.on("buzzer:locked", (lobbyCode) => {
    var foundUser = findUserBySocketId(socket.id);
    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        buzzerStateChanged("buzzer:locked", lobbyCode);
      }
    }
  });

  socket.on("lobby:kick", (lobbyCode, userSocketId) => {
    console.log("lobby:kick", lobbyCode, userSocketId);

    const requestingUser = findUserBySocketId(socket.id);
    if (!requestingUser) {
      console.log("User not found for socket ID:", socket.id);
      return;
    }

    const lobbyIndex = lobbys.findIndex(
      (lobby) => lobby.lobbyCode === lobbyCode
    );
    if (lobbyIndex === -1) {
      console.log("Lobby not found:", lobbyCode);
      return;
    }

    const lobby = lobbys[lobbyIndex];

    if (lobby.moderator.username !== requestingUser.username) {
      console.log("User is not moderator:", requestingUser.username);
      return;
    }

    const userToKickIndex = lobby.users.findIndex(
      (user) => user.socketId === userSocketId
    );
    if (userToKickIndex === -1) {
      console.log("User to kick not found:", userSocketId);
      return;
    }

    const userToKick = lobby.users[userToKickIndex];

    lobby.users.splice(userToKickIndex, 1);

    addEventToLobbyEventHistory(
      lobbyCode,
      "lobby:user:kicked",
      userToKick.username,
      { kickedBy: requestingUser.username }
    );

    io.to(userSocketId).emit("lobby:kicked", {
      message: "You have been kicked from the lobby",
    });

    emitMessage(lobbyCode, "lobby:user:kicked", userToKick.username);

    removeUserLobbyReference(userToKick.username, lobbyCode);
  });

  socket.on("disconnect", () => {
    var simplifiedUser = findSimplifiedUserBySocketId(socket.id);
    if (simplifiedUser) {
      // Add event to history
      addEventToLobbyEventHistory(
        simplifiedUser.lobbyCode,
        "lobby:user:left",
        simplifiedUser.username,
        ""
      );

      // Notify all clients in the lobby
      emitMessage(
        simplifiedUser.lobbyCode,
        "lobby:user:left",
        simplifiedUser.username
      );

      // Also remove the user from the lobby's users array
      const lobbyIndex = lobbys.findIndex(
        (lobby) => lobby.lobbyCode === simplifiedUser.lobbyCode
      );
      if (lobbyIndex !== -1) {
        const userIndex = lobbys[lobbyIndex].users.findIndex(
          (user) => user.socketId === socket.id
        );
        if (userIndex !== -1) {
          lobbys[lobbyIndex].users.splice(userIndex, 1);
        }
      }
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
    if (lobbyCode) {
      console.log("handleLobby lobbycode", lobbyCode, username);
      if (lobbys.some((lobby) => lobby.lobbyCode === lobbyCode)) {
        console.log("handleLobby lobby found", lobbyCode, username);
        addUser(lobbyCode, username);
        addUserToLobby(lobbyCode, username);
        socket.join(lobbyCode);
        sendCurrentBuzzerState(lobbyCode);
      } else {
        callback({ error: "Invalid Lobby Code" });
        return null;
      }
    } else {
      console.log("handleLobby new code ->", lobbyCode, username);
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
    console.log("addUser - userIndex:", userIndex);

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

  function getLobby(lobbyCode, username, socket) {
    if (!socket.auth.verified) {
      console.log("getLobby: User not authenticated");
      return { error: "Authentication required" };
    }

    var user = users.find((user) => user.username === username);
    console.log("getlobby - username:", username);

    // Check if the user exists and has lobbies
    if (!user || !user.lobbys) {
      console.log("User not found or has no lobbies");
      return { error: "User not found in lobby" };
    }

    // Check if user has access to this specific lobby
    if (!user.lobbys.some((lobby) => lobby.lobbyCode === lobbyCode)) {
      console.log("User has no access to this lobby");
      return { error: "No access to lobby" };
    }

    // User has access - continue
    socket.join(lobbyCode);
    sendCurrentBuzzerState(lobbyCode);

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    const isModerator = lobby.moderator.username === username;

    return { ...lobby, isModerator };
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

  function updateSocketIdForUserFromJwt(lobbyCode, socket) {
    if (!socket.auth.verified) {
      console.log("updateSocketId: User not verified");
      return false;
    }

    const username = socket.auth.username;
    const user = users.find((user) => user.username === username);
    let wasReconnect = false;

    if (!user) {
      console.log("User not found:", username);
      // Handle reconnecting user who doesn't exist in users array
      addUser(lobbyCode, username);
      addUserToLobby(lobbyCode, username);
      socket.join(lobbyCode);
      sendCurrentBuzzerState(lobbyCode);
      wasReconnect = true;
      return wasReconnect;
    }

    const lobbyIndex = user.lobbys.findIndex(
      (lobby) => lobby.lobbyCode === lobbyCode
    );

    if (lobbyIndex !== -1) {
      // Check if the socket ID has changed (indicating reconnect)
      const oldSocketId = user.lobbys[lobbyIndex].socketId;
      wasReconnect = oldSocketId !== socket.id;

      // Update socket ID
      user.lobbys[lobbyIndex].socketId = socket.id;
      console.log(
        `Updated socket ID for user ${username} from ${oldSocketId} to ${socket.id}, wasReconnect: ${wasReconnect}`
      );

      // Make sure user is in the socket.io room
      socket.join(lobbyCode);
    } else {
      console.log(`User ${username} has no access to lobby ${lobbyCode}`);
      // User has auth but no lobby record - add them
      addUser(lobbyCode, username);
      addUserToLobby(lobbyCode, username);
      socket.join(lobbyCode);
      wasReconnect = true;
    }

    return wasReconnect;
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

function removeUserLobbyReference(username, lobbyCode) {
  const userIndex = users.findIndex((user) => user.username === username);
  if (userIndex === -1) return;

  const user = users[userIndex];
  const lobbyIndex = user.lobbys.findIndex(
    (lobby) => lobby.lobbyCode === lobbyCode
  );
  if (lobbyIndex === -1) return;

  user.lobbys.splice(lobbyIndex, 1);
  console.log(`Removed lobby ${lobbyCode} reference from user ${username}`);
}

httpServer.listen(port, () => console.log(`listening on port ${port}`));
