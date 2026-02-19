import { internalMutation } from "./_generated/server";

// Migration: Convert old rooms with players array to new playerIds structure
export const migrateRoomsToPlayerIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db.query("rooms").collect();
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const room of rooms) {
      // Check if this room has old schema (players array)
      const oldPlayers = (room as any).players;
      const newPlayerIds = (room as any).playerIds;

      // Skip if already migrated
      if (newPlayerIds || !oldPlayers) {
        skipped++;
        continue;
      }

      try {
        // Extract player IDs from old players array
        const playerIds = oldPlayers.map((p: any) => p.id);

        // Create player records in the new players table
        for (const player of oldPlayers) {
          // Check if player already exists
          const existingPlayer = await ctx.db
            .query("players")
            .withIndex("by_room_and_playerId", (q) =>
              q.eq("roomId", room._id).eq("playerId", player.id)
            )
            .first();

          if (!existingPlayer) {
            await ctx.db.insert("players", {
              playerId: player.id,
              name: player.name,
              roomId: room._id,
              isOnline: player.isOnline,
              lastSeen: player.lastSeen,
              createdAt: room.createdAt,
            });
          }
        }

        // Update room with new structure
        await ctx.db.patch(room._id, {
          playerIds,
          players: undefined, // Remove old field
        } as any);

        migrated++;
      } catch (error) {
        console.error(`Failed to migrate room ${room._id}:`, error);
        errors++;
      }
    }

    return {
      total: rooms.length,
      migrated,
      skipped,
      errors,
    };
  },
});
