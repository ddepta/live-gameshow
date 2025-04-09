const express = require("express");
const path = require("path");
const app = express();
const httpServer = require("http").createServer(app);
const { get } = require("http");
const jwt = require("jsonwebtoken");
const { send } = require("process");
const io = require("socket.io")(httpServer, {
  cors: { origin: "*" },
});
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const cors = require("cors"); // Add CORS middleware import

const port = 3000;
var buzzerState = [];
var lobbyCodes = [];
// username, lobbys + socketId array
var users = [];

// Add temporary storage for avatar URLs by username
var tempAvatarUrls = {}; // Maps usernames to avatar URLs before user is fully registered

// lobbycode, moderator, users[], isActive, currentBuzzerState, points, event history
var lobbys = [];

const SECRET_KEY = "your-secret-key";

app.use(
  cors({
    origin: "*", // Allow all origins - adjust in production
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

app.get("/api/get-avatar/:username", (req, res) => {
  // Add specific CORS headers for this route
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  console.log("get-avatar called");

  const username = req.params.username;

  // Find the user in our users array
  const user = users.find((user) => user.username === username);
  console.log("User found:", user, username);
  console.log("users:", users);

  if (user && user.avatarUrl) {
    res.status(200).send({ avatarUrl: user.avatarUrl });
  } else {
    // No avatar found for this user
    res.status(404).send({ message: "No avatar found for this user" });
  }
});

app.post("/api/upload-avatar", upload.single("avatar"), (req, res) => {
  // Add specific CORS headers for this route
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const file = req.file;
  const username = req.body.username; // Assuming username is sent in the request

  if (file && username) {
    console.log("Avatar uploaded for user:", username, file.filename);

    // Generate avatar URL
    const avatarUrl = `${req.protocol}://${req.get("host")}/uploads/${
      file.filename
    }`;

    // Store the avatar URL with the user
    const userIndex = users.findIndex((user) => user.username === username);
    if (userIndex !== -1) {
      users[userIndex].avatarUrl = avatarUrl;
      console.log(
        `Updated avatar URL for existing user ${username}: ${avatarUrl}`
      );
    } else {
      // Store in temporary mapping if user doesn't exist yet
      tempAvatarUrls[username] = avatarUrl;
      console.log(`Stored temporary avatar URL for ${username}: ${avatarUrl}`);
    }

    res.status(200).send({
      message: "Avatar uploaded successfully",
      filename: file.filename,
      avatarUrl: avatarUrl,
    });
  } else {
    res.status(400).send({ message: "Avatar upload failed" });
  }
});

io.on("connection", (socket) => {
  console.log("a user connected with socket ID:", socket.id);

  // Update message handler to send messages with separate username field
  socket.on("message", (messageText) => {
    // Find which lobby this user belongs to
    const user = findSimplifiedUserBySocketId(socket.id);
    if (user && user.lobbyCode) {
      // Send message with separate username field
      console.log(
        `Chat message to lobby ${user.lobbyCode} from ${user.username}:`,
        messageText
      );
      io.to(user.lobbyCode).emit("message", {
        text: messageText,
        username: user.username,
      });
    } else {
      // Fallback if we can't determine the lobby
      console.log("Message from user without lobby:", socket.id);
      socket.emit("message", {
        text: messageText,
        username: "You",
      });
    }
  });

  socket.on("lobby:join", (lobbyCode, username, callback) => {
    console.log("lobby:joined with socket ID:", socket.id);
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
        emitUserList(lobbyCode); // Emit user list on join
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
        emitUserList(lobbyCode); // Emit user list on reconnect
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

  // Add new events for buzzer answer evaluation
  socket.on("buzzer:evaluate", (lobbyCode, isCorrect) => {
    console.log(
      `buzzer:evaluate - Answer marked as ${
        isCorrect ? "correct" : "incorrect"
      }`
    );
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Set the evaluation in the buzzer state
        if (
          lobby.currentBuzzerState &&
          lobby.currentBuzzerState.action === "buzzer:pressed"
        ) {
          // Update the buzzer state to include the evaluation
          lobby.currentBuzzerState.evaluation = {
            isCorrect: isCorrect,
            evaluatedAt: Date.now(),
            finalized: false,
          };

          // Emit the evaluation to all clients in the lobby
          io.to(lobbyCode).emit("buzzer:evaluated", {
            username: lobby.currentBuzzerState.username,
            isCorrect: isCorrect,
          });

          // Add to event history
          addEventToLobbyEventHistory(
            lobbyCode,
            "buzzer:evaluated",
            foundUser.username,
            {
              targetUser: lobby.currentBuzzerState.username,
              isCorrect: isCorrect,
            }
          );
        }
      }
    }
  });

  socket.on("buzzer:finalizeRound", (lobbyCode, addPoints) => {
    console.log(
      `buzzer:finalizeRound - Finalizing round, addPoints: ${addPoints}`
    );
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        if (lobby.currentBuzzerState && lobby.currentBuzzerState.evaluation) {
          // Mark the round as finalized
          lobby.currentBuzzerState.evaluation.finalized = true;

          // If adding points and the answer was correct
          if (addPoints && lobby.currentBuzzerState.evaluation.isCorrect) {
            // Find the user who answered
            const userSocketId = lobby.currentBuzzerState.socketId;

            // Points to award for a correct buzzer answer
            const pointsToAward = 1;

            // Find the user in the lobby
            let userFound = false;

            // Check if it's the moderator
            if (lobby.moderator.socketId === userSocketId) {
              if (!lobby.moderator.points) lobby.moderator.points = 0;
              lobby.moderator.points += pointsToAward;
              userFound = true;

              // Emit points updated event
              io.to(lobbyCode).emit("points:updated", {
                socketId: userSocketId,
                username: lobby.moderator.username,
                points: lobby.moderator.points,
              });
            }
            // Check regular users
            else {
              for (const user of lobby.users) {
                if (user.socketId === userSocketId) {
                  if (!user.points) user.points = 0;
                  user.points += pointsToAward;
                  userFound = true;

                  // Emit points updated event
                  io.to(lobbyCode).emit("points:updated", {
                    socketId: userSocketId,
                    username: user.username,
                    points: user.points,
                  });
                  break;
                }
              }
            }

            if (userFound) {
              // Log the points addition
              addEventToLobbyEventHistory(
                lobbyCode,
                "points:added",
                foundUser.username,
                {
                  targetUser: lobby.currentBuzzerState.username,
                  points: pointsToAward,
                  reason: "correct buzzer answer",
                }
              );
            }
          }

          // Emit round finalized event
          io.to(lobbyCode).emit("buzzer:roundFinalized", {
            username: lobby.currentBuzzerState.username,
            isCorrect: lobby.currentBuzzerState.evaluation.isCorrect,
            pointsAwarded:
              addPoints && lobby.currentBuzzerState.evaluation.isCorrect
                ? 1
                : 0,
          });

          // Add to event history
          addEventToLobbyEventHistory(
            lobbyCode,
            "buzzer:roundFinalized",
            foundUser.username,
            {
              targetUser: lobby.currentBuzzerState.username,
              isCorrect: lobby.currentBuzzerState.evaluation.isCorrect,
              pointsAwarded:
                addPoints && lobby.currentBuzzerState.evaluation.isCorrect
                  ? 1
                  : 0,
            }
          );
        }
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
    emitUserList(lobbyCode); // Emit user list after kick

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
          emitUserList(simplifiedUser.lobbyCode); // Emit user list on disconnect
        }
      }
    }
    console.log("a user disconnected!");
  });

  // Game events
  socket.on("game:start", (lobbyCode) => {
    console.log("Game started in lobby:", lobbyCode);
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.isGameActive = true;
        lobby.gameState.currentQuestionIndex = 0;

        // Broadcast game start to everyone in the lobby except sender
        socket.to(lobbyCode).emit("game:started");

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:started",
          foundUser.username,
          ""
        );
      }
    }
  });

  // Add new socket events for moderator to control question and answer visibility
  socket.on("game:sendQuestion", (lobbyCode) => {
    console.log("Question sent in lobby:", lobbyCode);
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.isQuestionVisible = true;

        // Broadcast to everyone in the lobby except sender
        socket.to(lobbyCode).emit("game:questionVisible");

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:questionVisible",
          foundUser.username,
          {}
        );
      }
    }
  });

  socket.on("game:sendAnswer", (lobbyCode) => {
    console.log("Answer sent in lobby:", lobbyCode);
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.isAnswerVisible = true;

        // Broadcast to everyone in the lobby except sender
        socket.to(lobbyCode).emit("game:answerVisible");

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:answerVisible",
          foundUser.username,
          {}
        );
      }
    }
  });

  socket.on("game:question:change", (lobbyCode, questionIndex) => {
    console.log(
      "Question changed in lobby:",
      lobbyCode,
      "to index:",
      questionIndex
    );
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.currentQuestionIndex = questionIndex;
        lobby.gameState.isQuestionVisible = false; // Reset visibility on question change
        lobby.gameState.isAnswerVisible = false;

        // Broadcast question change to everyone in the lobby except sender
        socket.to(lobbyCode).emit("game:question:change", questionIndex);

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:question:change",
          foundUser.username,
          { questionIndex: questionIndex }
        );
      }
    }
  });

  socket.on("game:end", (lobbyCode) => {
    console.log("Game ended in lobby:", lobbyCode);
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.isGameActive = false;
        lobby.gameState.isQuestionVisible = false;
        lobby.gameState.isAnswerVisible = false;

        // Change from io.in to socket.to to avoid sending to sender,
        // and fix event name to match what client is listening for
        socket.to(lobbyCode).emit("game:ended");

        // Update lobby state
        lobby.isActive = false;

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:ended", // Also update the event name in history for consistency
          foundUser.username,
          {}
        );

        console.log(
          `Game ended in lobby ${lobbyCode} by ${foundUser.username}`
        );
      } else {
        console.log("Unauthorized attempt to end game or lobby not found");
      }
    } else {
      console.log("Unknown user tried to end game");
    }
  });

  // Add new handler for getting game state
  socket.on("game:getState", (lobbyCode, callback) => {
    console.log("Game state requested for lobby:", lobbyCode);

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (lobby) {
      // Return the current game state
      callback({
        isGameActive: lobby.gameState.isGameActive,
        currentQuestionIndex: lobby.gameState.currentQuestionIndex,
        isQuestionVisible: lobby.gameState.isQuestionVisible,
        isAnswerVisible: lobby.gameState.isAnswerVisible,
      });
    } else {
      callback({ error: "Lobby not found" });
    }
  });

  // Add new socket events for moderator to hide questions and answers
  socket.on("game:hideQuestion", (lobbyCode) => {
    console.log("Question hidden in lobby:", lobbyCode);
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.isQuestionVisible = false;

        // Broadcast to everyone in the lobby except sender
        socket.to(lobbyCode).emit("game:questionHidden");

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:questionHidden",
          foundUser.username,
          {}
        );
      }
    }
  });

  socket.on("game:hideAnswer", (lobbyCode) => {
    console.log("Answer hidden in lobby:", lobbyCode);
    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby && lobby.moderator.username === foundUser.username) {
        // Update game state
        lobby.gameState.isAnswerVisible = false;

        // Broadcast to everyone in the lobby except sender
        socket.to(lobbyCode).emit("game:answerHidden");

        // Log event in lobby history
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:answerHidden",
          foundUser.username,
          {}
        );
      }
    }
  });

  // Add new handler for answer submissions
  socket.on("game:submitAnswer", (lobbyCode, questionIndex, answer, type) => {
    console.log(
      "Answer submitted in lobby:",
      lobbyCode,
      "for question:",
      questionIndex,
      "answer:",
      answer,
      "type:",
      type
    );

    const foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby) {
        // Initialize submittedAnswers if it doesn't exist
        if (!lobby.submittedAnswers) {
          lobby.submittedAnswers = [];
        }

        // Create the answer entry with a unique ID to help with updates
        const answerEntry = {
          id: `${foundUser.username}-${questionIndex}-${Date.now()}`,
          username: foundUser.username,
          questionIndex: questionIndex,
          answer: answer,
          type: type,
          timestamp: Date.now(),
          socketId: socket.id, // Add socket ID to identify the user more reliably
        };

        // Check if user already submitted answer for this question
        const existingAnswerIndex = lobby.submittedAnswers.findIndex(
          (a) =>
            a.username === foundUser.username &&
            a.questionIndex === questionIndex
        );

        if (existingAnswerIndex !== -1) {
          // Update existing answer
          lobby.submittedAnswers[existingAnswerIndex] = answerEntry;
        } else {
          // Add new answer
          lobby.submittedAnswers.push(answerEntry);
        }

        // Log event
        addEventToLobbyEventHistory(
          lobbyCode,
          "game:answer:submitted",
          foundUser.username,
          { questionIndex, answer, type }
        );

        // Get all answers for the current question
        const currentQuestionAnswers = lobby.submittedAnswers.filter(
          (a) => a.questionIndex === questionIndex
        );

        // Create detailed update payload
        const updatePayload = {
          lobbyCode: lobbyCode,
          answers: lobby.submittedAnswers, // All answers
          currentQuestionAnswers: currentQuestionAnswers, // Answers for current question only
          questionIndex: questionIndex,
          currentQuestionState: {
            index: lobby.gameState.currentQuestionIndex,
            total: currentQuestionAnswers.length,
            usernames: currentQuestionAnswers.map((a) => a.username),
          },
        };

        console.log("Sending all answers:", JSON.stringify(updatePayload));

        // Emit to everyone in the lobby
        io.to(lobbyCode).emit("game:answers", updatePayload);
      }
    }
  });

  // Add new socket events for points management
  socket.on("points:add", (lobbyCode, userSocketId, points) => {
    console.log(
      `Adding ${points} points to user ${userSocketId} in lobby ${lobbyCode}`
    );
    const foundUser = findUserBySocketId(socket.id);

    if (!foundUser) {
      console.log("User not found for socket ID:", socket.id);
      return;
    }

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (!lobby) {
      console.log("Lobby not found:", lobbyCode);
      return;
    }

    // Only moderators can add points
    if (lobby.moderator.username !== foundUser.username) {
      console.log("User is not moderator:", foundUser.username);
      return;
    }

    // Find the target user to give points to
    const targetUser = lobby.users.find(
      (user) => user.socketId === userSocketId
    );
    if (!targetUser) {
      // Check if it's the moderator who gets points
      if (lobby.moderator.socketId === userSocketId) {
        // Initialize points property if it doesn't exist
        if (!lobby.moderator.points) lobby.moderator.points = 0;
        lobby.moderator.points += points;

        // Broadcast the updated points
        io.to(lobbyCode).emit("points:updated", {
          socketId: userSocketId,
          username: lobby.moderator.username,
          points: lobby.moderator.points,
        });

        // Log the event
        addEventToLobbyEventHistory(
          lobbyCode,
          "points:added",
          foundUser.username,
          { targetUser: lobby.moderator.username, points: points }
        );
        return;
      }
      console.log("Target user not found:", userSocketId);
      return;
    }

    // Initialize points property if it doesn't exist
    if (!targetUser.points) targetUser.points = 0;
    targetUser.points += points;

    // Broadcast the updated points
    io.to(lobbyCode).emit("points:updated", {
      socketId: userSocketId,
      username: targetUser.username,
      points: targetUser.points,
    });

    // Log the event
    addEventToLobbyEventHistory(lobbyCode, "points:added", foundUser.username, {
      targetUser: targetUser.username,
      points: points,
    });
  });

  socket.on("points:set", (lobbyCode, userSocketId, points) => {
    console.log(
      `Setting points for user ${userSocketId} in lobby ${lobbyCode} to ${points}`
    );
    const foundUser = findUserBySocketId(socket.id);

    if (!foundUser) {
      console.log("User not found for socket ID:", socket.id);
      return;
    }

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (!lobby) {
      console.log("Lobby not found:", lobbyCode);
      return;
    }

    // Only moderators can set points
    if (lobby.moderator.username !== foundUser.username) {
      console.log("User is not moderator:", foundUser.username);
      return;
    }

    // Find the target user to set points for
    const targetUser = lobby.users.find(
      (user) => user.socketId === userSocketId
    );
    if (!targetUser) {
      // Check if it's the moderator whose points are being set
      if (lobby.moderator.socketId === userSocketId) {
        lobby.moderator.points = points;

        // Broadcast the updated points
        io.to(lobbyCode).emit("points:updated", {
          socketId: userSocketId,
          username: lobby.moderator.username,
          points: lobby.moderator.points,
        });

        // Log the event
        addEventToLobbyEventHistory(
          lobbyCode,
          "points:set",
          foundUser.username,
          { targetUser: lobby.moderator.username, points: points }
        );
        return;
      }
      console.log("Target user not found:", userSocketId);
      return;
    }

    // Set the points for the user
    targetUser.points = points;

    // Broadcast the updated points
    io.to(lobbyCode).emit("points:updated", {
      socketId: userSocketId,
      username: targetUser.username,
      points: targetUser.points,
    });

    // Log the event
    addEventToLobbyEventHistory(lobbyCode, "points:set", foundUser.username, {
      targetUser: targetUser.username,
      points: points,
    });
  });

  socket.on("points:reset", (lobbyCode) => {
    console.log(`Resetting all points in lobby ${lobbyCode}`);
    const foundUser = findUserBySocketId(socket.id);

    if (!foundUser) {
      console.log("User not found for socket ID:", socket.id);
      return;
    }

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (!lobby) {
      console.log("Lobby not found:", lobbyCode);
      return;
    }

    // Only moderators can reset points
    if (lobby.moderator.username !== foundUser.username) {
      console.log("User is not moderator:", foundUser.username);
      return;
    }

    // Reset points for all users in the lobby
    lobby.users.forEach((user) => {
      user.points = 0;
    });

    // Reset points for moderator too
    if (lobby.moderator) {
      lobby.moderator.points = 0;
    }

    // Broadcast that all points were reset
    io.to(lobbyCode).emit("points:allReset");

    // Log the event
    addEventToLobbyEventHistory(
      lobbyCode,
      "points:reset",
      foundUser.username,
      {}
    );
  });

  // Add new handler for getting points
  socket.on("points:get", (lobbyCode, callback) => {
    console.log(`Getting points for lobby ${lobbyCode}`);

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (!lobby) {
      console.log("Lobby not found:", lobbyCode);
      callback({ error: "Lobby not found" });
      return;
    }

    // Collect points for all users in the lobby
    const pointsData = {
      users: lobby.users.map((user) => ({
        socketId: user.socketId,
        username: user.username,
        points: user.points || 0,
      })),
      moderator: {
        socketId: lobby.moderator.socketId,
        username: lobby.moderator.username,
        points: lobby.moderator.points || 0,
      },
    };

    callback(pointsData);
  });

  // Add points when user submits a correct answer
  socket.on("game:answerCorrect", (lobbyCode, userSocketId, pointsToAdd) => {
    const foundUser = findUserBySocketId(socket.id);

    if (!foundUser) {
      console.log("User not found for socket ID:", socket.id);
      return;
    }

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (!lobby || lobby.moderator.username !== foundUser.username) {
      return; // Only moderators can mark answers as correct
    }

    // Default points to add if not specified
    const points = pointsToAdd || 1;

    // Re-use the points:add logic
    socket.emit("points:add", lobbyCode, userSocketId, points);
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

  // Update the lobby structure to include game state
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

      var moderator = { socketId: socket.id, username: username, points: 0 }; // Initialize moderator points
      var lobby = {
        lobbyCode: lobbyCode,
        moderator: moderator,
        users: [],
        isActive: true,
        currentBuzzerState: currentBuzzerState,
        eventHistory: [currentBuzzerState],
        // Add game state tracking
        gameState: {
          isGameActive: false,
          currentQuestionIndex: 0,
          isQuestionVisible: false,
          isAnswerVisible: false,
        },
        // Add submitted answers tracking
        submittedAnswers: [],
      };

      lobbys.push(lobby);
      addUser(lobbyCode, username);
      socket.join(lobbyCode);
    }
    return lobbyCode;
  }

  function addUser(lobbyCode, username) {
    // Rename the variable to avoid shadowing the global lobbys array
    var userLobbies = [];
    userLobbies.push({ lobbyCode: lobbyCode, socketId: socket.id });

    console.log(
      "addUser",
      username,
      "socketId:",
      socket.id,
      "lobbyCode:",
      lobbyCode
    );

    const userIndex = users.findIndex((user) => user.username === username);
    console.log("addUser - userIndex:", userIndex);

    if (userIndex != -1) {
      // Update existing user's lobbies
      const lobbyExists = users[userIndex].lobbys.some(
        (lobby) => lobby.lobbyCode === lobbyCode
      );

      if (!lobbyExists) {
        users[userIndex].lobbys.push({
          lobbyCode: lobbyCode,
          socketId: socket.id,
        });
        console.log(
          `Added lobby ${lobbyCode} to existing user ${username} with socket ${socket.id}`
        );
      } else {
        // Update socket ID for existing lobby
        const lobbyIndex = users[userIndex].lobbys.findIndex(
          (lobby) => lobby.lobbyCode === lobbyCode
        );
        if (lobbyIndex !== -1) {
          console.log(
            `Updated socket ID for user ${username} in lobby ${lobbyCode} from ${users[userIndex].lobbys[lobbyIndex].socketId} to ${socket.id}`
          );
          users[userIndex].lobbys[lobbyIndex].socketId = socket.id;
        }
      }
      users[userIndex].username = username;
      // Make sure avatarUrl exists even if it didn't before
      users[userIndex].avatarUrl = users[userIndex].avatarUrl || "";
    } else {
      // Check if there's a cached avatar URL for this new user
      const cachedAvatarUrl = tempAvatarUrls[username] || "";

      // Add new user with cached avatar URL if available
      users.push({
        username: username,
        lobbys: userLobbies,
        avatarUrl: cachedAvatarUrl, // Use cached avatar URL if available
      });

      if (cachedAvatarUrl) {
        console.log(
          `Using cached avatar URL for new user ${username}: ${cachedAvatarUrl}`
        );
        // Clean up the temporary storage since we've used it
        delete tempAvatarUrls[username];
      } else {
        console.log(`Added new user ${username} with empty avatar`);
      }
    }

    // Debug output to see the full users array
    console.log("Current users array:", JSON.stringify(users, null, 2));
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
        points: 0, // Initialize points to zero
      });

      addEventToLobbyEventHistory(lobbyCode, "lobby:user:joined", username, "");
      emitUserList(lobbyCode); // Emit user list when user added to existing lobby
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

    // Make sure all users are in the lobby (check for missing users)
    ensureAllRegisteredUsersInLobby(lobbyCode);

    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    const isModerator = lobby.moderator.username === username;

    // Log current users in lobby for debugging
    console.log(
      `Current users in lobby ${lobbyCode}:`,
      lobby.users.map((u) => u.username)
    );

    return {
      ...lobby,
      isModerator,
      // Include game state in response
      gameState: lobby.gameState,
    };
  }

  function emitMessage(recipient, event, data) {
    console.log("emitMessage", recipient, event, data);
    io.to(recipient).emit(event, data);
  }

  function buzzerStateChanged(action, lobbyCode) {
    // Add more robust logging
    console.log(
      `buzzerStateChanged called - action: ${action}, lobbyCode: ${lobbyCode}, socketId: ${socket.id}`
    );

    var foundUser = findUserBySocketId(socket.id);

    if (foundUser) {
      console.log("buzzerStateChanged", action, lobbyCode, foundUser);

      const index = lobbys.findIndex((lobby) => lobby.lobbyCode === lobbyCode);
      if (index === -1) {
        console.log(`Lobby ${lobbyCode} not found`);
        return;
      }

      currentBuzzerState = {
        action: action,
        socketId: socket.id,
        username: foundUser.username,
        data: "",
        // Initialize the buzzer state with evaluation fields when a buzzer is pressed
        evaluation:
          action === "buzzer:pressed"
            ? {
                isCorrect: null,
                evaluatedAt: null,
                finalized: false,
              }
            : null,
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

      // Try to recover by checking if this socket is in any lobby's users array
      const lobbyWithUser = lobbys.find(
        (lobby) =>
          lobby.users.some((user) => user.socketId === socket.id) ||
          (lobby.moderator && lobby.moderator.socketId === socket.id)
      );

      if (lobbyWithUser) {
        // Found the user in a lobby, try to get their username
        const userInLobby = lobbyWithUser.users.find(
          (user) => user.socketId === socket.id
        );
        const username = userInLobby
          ? userInLobby.username
          : lobbyWithUser.moderator &&
            lobbyWithUser.moderator.socketId === socket.id
          ? lobbyWithUser.moderator.username
          : "Unknown User";

        console.log(
          `User found in lobby but not in users array. Username: ${username}, fixing...`
        );

        // Recreate the user entry in the users array
        const userLobbies = [];
        userLobbies.push({ lobbyCode, socketId: socket.id });

        users.push({
          username: username,
          lobbys: userLobbies,
        });

        // Now try the buzzer action again
        currentBuzzerState = {
          action: action,
          socketId: socket.id,
          username: username,
          data: "",
          evaluation:
            action === "buzzer:pressed"
              ? {
                  isCorrect: null,
                  evaluatedAt: null,
                  finalized: false,
                }
              : null,
        };

        const lobbyIndex = lobbys.findIndex((l) => l.lobbyCode === lobbyCode);
        if (lobbyIndex !== -1) {
          lobbys[lobbyIndex].currentBuzzerState = currentBuzzerState;
          addEventToLobbyEventHistory(lobbyCode, action, username, "");
          emitMessage(lobbyCode, action, username);
          console.log(`Recovered buzzer action for ${username}`);
        }
      }
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

      // Update socket ID in user's lobbys array
      user.lobbys[lobbyIndex].socketId = socket.id;
      console.log(
        `Updated socket ID for user ${username} from ${oldSocketId} to ${socket.id}, wasReconnect: ${wasReconnect}`
      );

      // Make sure user is in the socket.io room
      socket.join(lobbyCode);

      // Get the lobby
      const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
      if (lobby) {
        // Log the current users in lobby before making changes
        console.log(
          `Current users in lobby before update:`,
          lobby.users.map((u) => u.username)
        );

        // Check if this user is the moderator
        const isModerator = lobby.moderator.username === username;

        if (isModerator) {
          console.log(
            `User ${username} is the moderator, updating moderator socket ID`
          );
          // Update the moderator's socket ID
          lobby.moderator.socketId = socket.id;

          // Remove the moderator from users array if they were accidentally added before
          const moderatorInUsersIndex = lobby.users.findIndex(
            (u) => u.username === username
          );
          if (moderatorInUsersIndex !== -1) {
            console.log(`Removing moderator ${username} from users array`);
            lobby.users.splice(moderatorInUsersIndex, 1);
          }
        } else {
          // Regular user handling
          const userInLobby = lobby.users.find((u) => u.username === username);
          if (!userInLobby) {
            console.log(
              `Re-adding user ${username} to lobby's users array on reconnect`
            );
            // User isn't in the lobby's users array, add them back
            lobby.users.push({
              socketId: socket.id,
              username: username,
            });
          } else {
            // User exists in lobby but needs socket ID updated
            userInLobby.socketId = socket.id;
            console.log(
              `Updated socket ID for existing user ${username} in lobby`
            );
          }
        }

        // Ensure all registered users are present in the lobby
        ensureAllRegisteredUsersInLobby(lobbyCode);

        // Log the updated users list
        console.log(
          `Users in lobby after update:`,
          lobby.users.map((u) => u.username)
        );
      }
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

  // Function to ensure all registered users are in the lobby users array
  function ensureAllRegisteredUsersInLobby(lobbyCode) {
    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (!lobby) return;

    // Get all users who should be in this lobby
    const registeredUsers = users.filter((user) =>
      user.lobbys.some((l) => l.lobbyCode === lobbyCode)
    );

    console.log(
      `Ensuring ${registeredUsers.length} registered users are in lobby ${lobbyCode}`
    );

    // Make sure each registered user is in the lobby users array
    registeredUsers.forEach((registeredUser) => {
      const username = registeredUser.username;

      // Skip the moderator - they should not be in the users array
      if (lobby.moderator.username === username) {
        console.log(
          `Skipping moderator ${username} in ensureAllRegisteredUsersInLobby`
        );
        return;
      }

      const userSocketId = registeredUser.lobbys.find(
        (l) => l.lobbyCode === lobbyCode
      )?.socketId;

      if (!userSocketId) return;

      // Check if this user is already in the lobby's users array
      const existsInLobby = lobby.users.some((u) => u.username === username);

      // If not, add them
      if (!existsInLobby) {
        console.log(`Re-adding missing user ${username} to lobby ${lobbyCode}`);
        lobby.users.push({
          socketId: userSocketId,
          username: username,
        });
      }
    });
  }

  // New function to emit the current user list to all clients in a lobby
  function emitUserList(lobbyCode) {
    const lobby = lobbys.find((lobby) => lobby.lobbyCode === lobbyCode);
    if (lobby) {
      const userListPayload = {
        lobbyCode: lobbyCode, // Include lobbyCode in the payload
        users: lobby.users.map((user) => ({
          socketId: user.socketId,
          username: user.username,
          points: user.points || 0, // Include points
        })),
        moderator: {
          socketId: lobby.moderator.socketId,
          username: lobby.moderator.username,
          points: lobby.moderator.points || 0, // Include moderator points
        },
      };

      console.log(
        `Emitting updated user list for lobby ${lobbyCode} with ${lobby.users.length} users:`,
        userListPayload
      );
      io.to(lobbyCode).emit("lobby:userList", userListPayload);
    } else {
      console.log(`emitUserList: Lobby not found for code ${lobbyCode}`);
    }
  }
});

function findUserBySocketId(socketId) {
  // Improved error handling and debugging
  if (!socketId) {
    console.log("findUserBySocketId called with null/undefined socketId");
    return null;
  }

  console.log(`Finding user by socketId: ${socketId}`);

  for (const user of users) {
    // Check if this user has any lobbies with this socketId
    const foundLobby = user.lobbys.find((lobby) => lobby.socketId === socketId);
    if (foundLobby) {
      console.log(
        `Found user ${user.username} with socket ${socketId} in lobby ${foundLobby.lobbyCode}`
      );
      return user;
    }
  }

  // If we get here, no user was found with this socket ID
  console.log(
    `No user found with socket ${socketId}. Current socket IDs in system:`,
    users.flatMap((user) => user.lobbys.map((l) => l.socketId))
  );
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
