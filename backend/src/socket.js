import { Server } from "socket.io";
import prisma from "./prisma.js";
import { verifyJWT } from "./utils/auth.js";

let io;

function getCookie(cookieString, name) {
  if (!cookieString) return null;
  const pairs = cookieString.split(";");
  for (const pair of pairs) {
    const [key, value] = pair.trim().split("=");
    if (key === name) return value;
  }
  return null;
}

/**
 * Initialize Socket.IO
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
        : "*",
      credentials: true,
    },
  });

  /**
   * 🔐 SOCKET AUTH MIDDLEWARE
   */
  io.use(async (socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token && socket.handshake.headers?.cookie) {
        token = getCookie(socket.handshake.headers.cookie, "auth_token");
      }

      if (!token) {
        console.error("❌ SOCKET: Missing token");
        return next(new Error("Authentication required"));
      }

      // 🔍 Verify JWT using local auth utility
      const payload = verifyJWT(token);
      if (!payload) {
        console.error("❌ SOCKET: Invalid or expired token");
        return next(new Error("Invalid token"));
      }

      // Support userId or sub
      const userId = payload.userId || payload.sub;

      if (!userId) {
        console.error("❌ SOCKET: userId missing in token");
        return next(new Error("Invalid token payload"));
      }

      // 🔍 Load gym user
      const user = await prisma.gymUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          gymId: true,
          name: true,
        },
      });

      if (!user) {
        console.error("❌ SOCKET: GymUser not found");
        return next(new Error("Invalid user"));
      }

      // 🔐 Attach user to socket
      socket.user = user;

      console.log("✅ SOCKET AUTH OK:", user.id);
      next();
    } catch (err) {
      console.error("❌ SOCKET AUTH ERROR:", err.message);
      next(new Error(err.message || "Socket authentication failed"));
    }
  });

  /**
   * 🔌 SOCKET CONNECTION
   */
  io.on("connection", async (socket) => {
    const { id: userId, gymId } = socket.user;

    console.log("🔌 SOCKET CONNECTED:", userId);

    // 🔒 Auto-join gym room if gymId exists
    if (gymId) {
      socket.join(`gym:${gymId}`);
    }

    /**
     * Join conversation room
     */
    socket.on("join-conversation", async (conversationId) => {
      if (!conversationId) return;

      // Note: We can implement gym-based verification for conversation access
      // For now, allow joining if the conversation is associated with the gym.
      socket.join(`conversation:${conversationId}`);
      console.log(`👤 User ${userId} joined conversation:${conversationId}`);
    });

    socket.on("leave-conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`👤 User ${userId} left conversation:${conversationId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ SOCKET DISCONNECTED:", userId, reason);
    });
  });

  return io;
}

/**
 * Safe getter
 */
export function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}
