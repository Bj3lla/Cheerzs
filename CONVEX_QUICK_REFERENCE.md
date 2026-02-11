# Convex Quick Reference

## Essential Commands

```bash
# Start development server (generates types, watches for changes)
npm run convex:dev

# Open Convex dashboard
npm run convex:dashboard

# Migrate data from existing files
npm run convex:migrate

# Deploy to production
npm run convex:deploy

# Clear all data (careful!)
npm run convex:clear
```

---

## Common Patterns

### 1. Create a Mutation

```typescript
// convex/myFunction.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const doSomething = mutation({
  args: {
    roomId: v.id("rooms"),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    // Read data
    const room = await ctx.db.get(args.roomId);
    
    // Update data
    await ctx.db.patch(args.roomId, {
      someField: args.value,
    });
    
    return { success: true };
  },
});
```

### 2. Create a Query

```typescript
// convex/myFunction.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getSomething = query({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

### 3. Use in React Component

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function MyComponent() {
  // Query (automatically updates!)
  const data = useQuery(api.myFunction.getSomething, { id });
  
  // Mutation
  const doSomething = useMutation(api.myFunction.doSomething);
  
  const handleClick = async () => {
    await doSomething({ roomId: id, value: "test" });
  };
  
  if (data === undefined) return <div>Loading...</div>;
  
  return <div>{data.someField}</div>;
}
```

---

## Data Operations

### Insert
```typescript
const id = await ctx.db.insert("rooms", {
  code: "ABC123",
  status: "waiting",
  createdAt: Date.now(),
});
```

### Get by ID
```typescript
const room = await ctx.db.get(roomId);
```

### Update
```typescript
await ctx.db.patch(roomId, {
  status: "playing",
  lastActivity: Date.now(),
});
```

### Delete
```typescript
await ctx.db.delete(roomId);
```

### Query with Index
```typescript
const room = await ctx.db
  .query("rooms")
  .withIndex("by_code", (q) => q.eq("code", "ABC123"))
  .first();
```

### Query with Filter
```typescript
const activeRooms = await ctx.db
  .query("rooms")
  .filter((q) => q.eq(q.field("status"), "playing"))
  .collect();
```

---

## Migration Patterns

### From Ably Channel → Convex Query

**Before (Ably):**
```typescript
const channel = ably.channels.get(`room:${roomId}`);

// Subscribe to updates
channel.subscribe("state-update", (msg) => {
  setRoomState(msg.data);
});

// Publish update
channel.publish("state-update", { players });
```

**After (Convex):**
```typescript
// Subscribe (automatic updates!)
const room = useQuery(api.rooms.getRoom, { roomId });

// Update
const updateRoom = useMutation(api.rooms.updateRoom);
await updateRoom({ roomId, players });
// All subscribers get the update automatically!
```

### From Vercel API Route → Convex Mutation

**Before (Vercel API):**
```typescript
// api/create-room.ts
export default async function handler(req, res) {
  const { hostId, hostName } = req.body;
  
  // Create in database
  const { data } = await supabase
    .from('rooms')
    .insert({ hostId, hostName });
  
  // Publish to Ably
  await channel.publish('room-created', data);
  
  res.json(data);
}
```

**After (Convex):**
```typescript
// convex/rooms.ts
export const createRoom = mutation({
  args: { hostId: v.string(), hostName: v.string() },
  handler: async (ctx, args) => {
    const roomId = await ctx.db.insert("rooms", {
      hostId: args.hostId,
      hostName: args.hostName,
    });
    
    return { roomId };
    // Real-time updates automatic!
  },
});
```

### From Manual State Sync → Automatic

**Before:**
```typescript
// Update database
await supabase.from('rooms').update({ status: 'playing' });

// Manually sync to Ably
await channel.publish('status-update', { status: 'playing' });

// Update local state
setRoomStatus('playing');
```

**After:**
```typescript
// Update once, everything syncs automatically!
await updateStatus({ roomId, status: 'playing' });

// UI updates automatically via useQuery
const room = useQuery(api.rooms.getRoom, { roomId });
```

---

## Type Patterns

### Function Args
```typescript
export const myFunction = mutation({
  args: {
    // String
    name: v.string(),
    
    // Number
    age: v.number(),
    
    // Boolean
    isActive: v.boolean(),
    
    // ID reference
    roomId: v.id("rooms"),
    
    // Optional
    nickname: v.optional(v.string()),
    
    // Array
    tags: v.array(v.string()),
    
    // Object
    metadata: v.object({
      key: v.string(),
      value: v.number(),
    }),
    
    // Union (enum-like)
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    
    // Any (use sparingly!)
    data: v.any(),
  },
  handler: async (ctx, args) => {
    // args is fully typed!
  },
});
```

---

## Testing Patterns

### Test Queries in Dashboard

1. Open dashboard: `npm run convex:dashboard`
2. Click "Functions" → Your function
3. Enter test args in JSON
4. Click "Run"
5. See results instantly

### Test in Code

```typescript
// vitest example
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

test("create room", async () => {
  const t = convexTest(schema);
  
  const { roomId, code } = await t.mutation(api.rooms.createRoom, {
    hostId: "user1",
    hostName: "Alice",
    gameMode: "classic",
  });
  
  expect(code).toHaveLength(6);
  
  const room = await t.query(api.rooms.getRoom, { roomId });
  expect(room.hostId).toBe("user1");
});
```

---

## Debugging Tips

### 1. Check Convex Dashboard
- View all data in tables
- See function execution logs
- Monitor performance

### 2. Add Console Logs
```typescript
export const myFunction = mutation({
  handler: async (ctx, args) => {
    console.log("Args:", args);  // Shows in dashboard logs
    const result = await someOperation();
    console.log("Result:", result);
    return result;
  },
});
```

### 3. View Logs in Terminal
```bash
npx convex logs --watch
```

### 4. Check Generated Types
If types seem wrong, restart `convex dev`:
```bash
# Stop convex dev (Ctrl+C)
npm run convex:dev
```

---

## Performance Tips

### 1. Use Indexes for Queries
```typescript
// In schema.ts
.index("by_status", ["status"])

// Then query with index
await ctx.db
  .query("rooms")
  .withIndex("by_status", (q) => q.eq("status", "playing"))
  .collect();
```

### 2. Limit Query Results
```typescript
// Take first 10
const rooms = await ctx.db
  .query("rooms")
  .take(10);

// Or use pagination
const rooms = await ctx.db
  .query("rooms")
  .paginate(args.paginationOpts);
```

### 3. Use Optional for Expensive Queries
```typescript
// Only fetch if needed
const details = args.includeDetails
  ? await ctx.db.get(args.detailsId)
  : undefined;
```

---

## Common Gotchas

### 1. Queries Can't Modify Data
```typescript
// ❌ This won't work
export const badQuery = query({
  handler: async (ctx) => {
    await ctx.db.insert("rooms", {}); // Error!
  },
});

// ✅ Use mutation instead
export const goodMutation = mutation({
  handler: async (ctx) => {
    await ctx.db.insert("rooms", {});
  },
});
```

### 2. Undefined vs Null
```typescript
// useQuery returns undefined while loading
const room = useQuery(api.rooms.getRoom, { roomId });

if (room === undefined) {
  return <div>Loading...</div>;
}

if (room === null) {
  return <div>Room not found</div>;
}

return <div>{room.code}</div>;
```

### 3. Don't Call Mutations in Queries
```typescript
// ❌ Don't do this
export const badQuery = query({
  handler: async (ctx) => {
    const room = await createRoom(ctx, args); // ❌
    return room;
  },
});

// ✅ Call mutation from component
const createRoom = useMutation(api.rooms.createRoom);
await createRoom(args);
```

---

## Environment Variables

```bash
# .env
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Auto-generated by `npx convex dev`
```

---

## Deployment Checklist

- [ ] All tests passing
- [ ] Data migrated successfully
- [ ] Tested in development
- [ ] Removed old Ably code
- [ ] Updated environment variables
- [ ] Run `npm run convex:deploy`
- [ ] Deploy frontend to Vercel
- [ ] Test in production
- [ ] Monitor dashboard for errors

---

## Resources

- [Convex Docs](https://docs.convex.dev)
- [React Quick Start](https://docs.convex.dev/quickstart/react)
- [Database Guide](https://docs.convex.dev/database)
- [Functions Guide](https://docs.convex.dev/functions)
- [Discord](https://discord.gg/convex)

---

## Get Help

1. Check [Convex Docs](https://docs.convex.dev) first
2. Search [Discord](https://discord.gg/convex) for similar issues
3. Ask in Discord #help channel
4. Check dashboard logs for errors

Happy coding with Convex! 🚀
