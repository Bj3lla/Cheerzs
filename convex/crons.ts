import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up stale rooms every hour
crons.interval(
  "cleanup stale rooms",
  { hours: 1 }, // Run every hour
  internal.rooms.cleanupStaleRooms
);

export default crons;
