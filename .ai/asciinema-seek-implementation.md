# Asciinema Player Seek Implementation Analysis

## Key Finding: Asciinema Uses Full Rebuild Approach ✅

After analyzing the asciinema-player source code, **asciinema uses the exact same approach we proposed**: **full terminal rebuild when seeking backward**.

## Implementation Details

### Source: `src/driver/recording.js` - `seek()` function

```javascript
async function seek(where) {
  // ... pause and calculate targetTime ...
  
  // KEY: If seeking backward, reset terminal completely
  if (targetTime < lastEventTime) {
    feed("\x1bc"); // ESC c - terminal reset command
    resizeTerminalToInitialSize();
    nextEventIndex = 0;
    lastEventTime = 0;
  }

  // Fast-forward through events up to target time
  let event = events[nextEventIndex];
  while (event && event[0] <= targetTime) {
    if (event[1] === "o" || event[1] === "r") {
      executeEvent(event); // Feed data to terminal
    }
    lastEventTime = event[0];
    event = events[++nextEventIndex];
  }

  pauseElapsedTime = targetTime * 1000;
  // ... resume if was playing ...
}
```

## How It Works

### 1. **Backward Seek Detection**
```javascript
if (targetTime < lastEventTime) {
  // Seeking backward - need to reset
}
```

### 2. **Terminal Reset**
- `feed("\x1bc")` - Sends ANSI reset sequence (ESC c) to clear terminal
- `resizeTerminalToInitialSize()` - Resets terminal dimensions
- `nextEventIndex = 0` - Reset to beginning of events
- `lastEventTime = 0` - Reset time tracking

### 3. **Fast-Forward to Target**
- Loop through events from start (index 0)
- Execute each event up to target time
- Terminal state builds up naturally

### 4. **Forward Seek**
- If seeking forward, no reset needed
- Just fast-forward from current position

## Key Insights

### ✅ **Full Rebuild is Industry Standard**
- Asciinema (the reference implementation) uses full rebuild
- This confirms our approach is correct and proven

### ✅ **Reset Command: `\x1bc` (ESC c)**
- ANSI escape sequence for terminal reset
- Clears screen, resets cursor, clears scrollback
- Equivalent to `terminal.clear()` in xterm.js

### ✅ **Event-Based Fast-Forward**
- Events are stored in memory (already parsed)
- Fast-forward is just iterating through array
- No API calls needed during seek

### ✅ **Smart Optimization**
- Only resets when seeking backward
- Forward seeks just continue from current position
- Minimizes unnecessary work

## Comparison: Our Implementation vs Asciinema

| Aspect | Asciinema | Our Approach |
|--------|-----------|--------------|
| **Backward Seek** | Reset terminal (`\x1bc`) + rebuild | Clear terminal + rebuild |
| **Forward Seek** | Fast-forward from current | Fast-forward from current |
| **Event Storage** | In-memory array (already parsed) | API fetch (time-based query) |
| **Reset Method** | ANSI ESC c sequence | `terminal.clear()` (xterm.js) |
| **State Tracking** | `nextEventIndex`, `lastEventTime` | `lastRenderedChunkIndex`, timeline position |

## Why This Approach Works

1. **Terminal is Stateless** - Each rebuild starts fresh
2. **Events are Ordered** - Applying in order gives correct state
3. **Carriage Returns Work** - They naturally overwrite previous content
4. **Simple & Reliable** - No complex state management needed

## Our Implementation Strategy

Based on asciinema's approach, we should:

1. **Detect backward seeks**: `if (newTime < currentTime)`
2. **Clear terminal**: `terminal.clear()` (xterm.js equivalent of `\x1bc`)
3. **Reset tracking**: `lastRenderedChunkIndex = -1`
4. **Fetch chunks**: Query API for chunks up to target time
5. **Apply chunks**: Write all chunks in order (fast-forward, no delays)
6. **Update state**: Set timeline position, update tracking

## Performance Considerations

### Asciinema's Advantages
- Events already in memory (parsed cast file)
- No network requests during seek
- Very fast iteration through array

### Our Challenges
- Need to fetch chunks from API/Redis
- Network latency during seek
- Need caching strategy

### Our Solutions
- **Debouncing**: Wait 150ms after scrubbing stops
- **Caching**: Cache chunks by time ranges
- **Smart Fetching**: Only fetch when needed
- **Progressive Loading**: Show loading indicator during fetch

## Conclusion

**Our full rebuild approach is correct and matches industry standard (asciinema).**

The main difference is:
- **Asciinema**: Events in memory → instant seek
- **Ours**: Events from API → need fetch + debounce

But the core principle is the same: **reset terminal and rebuild state from scratch when seeking backward**.

