import { Server } from "socket.io";

const meetings = {}; // meetingId -> [socketId1, socketId2]

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    socket.on("join-meeting", ({ meetingId }) => {
      socket.join(meetingId);

      if (!meetings[meetingId]) {
        meetings[meetingId] = [];
      }

      if (!meetings[meetingId].includes(socket.id)) {
        meetings[meetingId].push(socket.id);
      }

      const participants = meetings[meetingId].map((id, index) => ({
        id,
        label: `U${index + 1}`,
      }));

      io.to(meetingId).emit("participants-init", participants);
      socket.to(meetingId).emit("user-joined", socket.id);
    });

    socket.on("media-state", ({ meetingId, videoOn, micOn }) => {
      socket.to(meetingId).emit("media-state", {
        from: socket.id,
        videoOn,
        micOn,
      });
    });

    socket.on("offer", ({ to, offer }) => {
      io.to(to).emit("offer", { from: socket.id, offer });
    });

    socket.on("answer", ({ to, answer }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", {
        from: socket.id,
        candidate,
      });
    });

    socket.on("leave-meeting", (meetingId) => {
      meetings[meetingId] =
        meetings[meetingId]?.filter((id) => id !== socket.id) || [];

      socket.leave(meetingId);

      const updated = meetings[meetingId].map((id, index) => ({
        id,
        label: `U${index + 1}`,
      }));

      io.to(meetingId).emit("participants-init", updated);
      socket.to(meetingId).emit("user-left", socket.id);
    });

    socket.on("disconnect", () => {
      for (const meetingId in meetings) {
        meetings[meetingId] = meetings[meetingId].filter(
          (id) => id !== socket.id
        );

        const updated = meetings[meetingId].map((id, index) => ({
          id,
          label: `U${index + 1}`,
        }));

        io.to(meetingId).emit("participants-init", updated);
      }

      console.log("🔴 Disconnected:", socket.id);
    });
  });

  return io; // 🔥 VERY IMPORTANT
};
