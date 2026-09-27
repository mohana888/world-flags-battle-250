
# WORLD FLAGS BATTLE — 250

A 250-flag real-time battle royale designed for live streaming.

## Roster

The project contains 250 flag entries. The roster is based on ISO-style country/territory entries plus Kosovo to reach exactly 250. The game treats every entry as a fictional game contestant; game strength is NOT a statement about the real-world strength of a country.

## Gameplay

Every flag:
- has position, velocity, health and energy;
- collides with other flags;
- receives damage from impacts and the shrinking arena;
- can receive temporary viewer boosts;
- can activate temporary shields;
- can be eliminated;
- remains synchronized through Socket.IO.

The final surviving flag is the "WORLD FLAGS BATTLE CHAMPION".

## Run

```bash
npm install
npm start
```

Open:

http://localhost:3000

## Test viewer commands

In the browser console:

```js
socket.emit("command", {text:"India"})
socket.emit("command", {text:"🇩🇪"})
socket.emit("command", {text:"Brazil"})
```

## Streaming

Add:

```text
http://localhost:3000
```

as an OBS Browser Source.

For production:
- keep the game simulation on the server;
- consume YouTube/Twitch chat server-side;
- aggregate commands over short windows;
- add rate limits and moderation;
- use Redis if the stream gets high traffic;
- persist results in PostgreSQL.

## Making the battle more realistic

The next renderer can use Phaser + Matter.js or a 3D engine. The current version deliberately uses a lightweight custom server simulation so the 250-fighter battle can run without a large engine download.

Possible future mechanics:
- 3D arenas
- walls and obstacles
- ramps
- projectiles
- destructible objects
- team alliances
- weather
- lightning
- earthquakes
- tornadoes
- volcanoes
- power-ups
- boss events
- replay camera
- cinematic eliminations
- viewer voting
- Twitch/YouTube integration
- live leaderboards

Use original art, audio, branding and game rules rather than copying another game's assets or implementation.
## IMPORTANT — Real Flag Images

The renderer now uses actual rectangular flag PNG images rather than circles.

Flag image source format:

```text
https://flagcdn.com/w80/{ISO_ALPHA_2_CODE}.png
```

The 250-entry roster contains an ISO-style two-letter code for each entry. The browser loads the corresponding flag image and displays it as the fighter.

If you want a completely self-contained/offline version, download the flag PNGs into:

```text
public/flags/
```

and change `flagUrl()` in `public/game.js` to:

```js
return `/flags/${code.toLowerCase()}.png`;
```

This is preferable for a production stream because it removes an external image dependency.


## Exact Battle Rule

The arena is a circle.

- All 250 flags start **inside the circle**.
- Flags move and collide using the physics simulation.
- The circle is the elimination boundary.
- **If a flag crosses outside the circle, it is immediately eliminated.**
- The eliminated flag cannot re-enter.
- The circle gradually shrinks during the battle, increasing pressure.
- Viewer boosts can affect movement/shields, but they do not directly decide the winner.
- **When only one flag remains inside the circle, that flag wins the battle.**

So the sequence is:

```text
250 flags
   ↓
flags collide / move
   ↓
one crosses circle → ELIMINATED
   ↓
249 flags
   ↓
...
   ↓
2 flags
   ↓
one crosses circle → ELIMINATED
   ↓
1 flag remains inside
   ↓
🏆 WINNER
```

The game does NOT use health reaching zero as the win condition. Ring-out is the primary elimination rule.


## Rotating Opening & Medium Speed

One side of the circle is open and rotates slowly. The remaining ring is solid and bounces flags back inside. A flag can be eliminated only by escaping through the moving opening. Flag movement is deliberately medium-speed (not too fast). The arena continues to shrink, and the last flag inside wins.


## Correct Movement Model

The flags **do not travel around the circumference in sequence**.

At the beginning of every round:

- all 250 flags spawn together in a compact area around the center;
- each flag receives a different random velocity;
- flags move freely in 2D;
- flags collide with one another and bounce;
- flags are pushed back by the circular wall;
- there is no circular/orbital path assigned to any flag;
- the rotating gap is the only way to leave the arena;
- when a flag reaches the gap and crosses outside, it is eliminated;
- the last flag still inside the circle wins.

This makes the motion resemble hundreds of small balls bouncing in a central arena rather than flags travelling around the perimeter.


## V2 Movement Fix

The flags do not travel around the circumference. There is no tangential/orbital force. They move freely in 2D like bouncing balls, with a soft central restoring force. Their speed is increased to make the action visibly faster while keeping it watchable. The rotating outer gap remains the only elimination exit.


## Final Boundary Rule

This version uses the requested rule exactly:

1. Flags move freely like balls inside the circle.
2. A flag touching the solid circular outline **bounces back inside**.
3. Collisions with other flags only cause physical bouncing; they do **not** eliminate a flag.
4. The rotating yellow gap is the only opening.
5. A flag entering the gap is allowed to travel outward.
6. The flag is eliminated **only after it has actually moved outside the circle**.
7. The final flag that remains inside is the winner.

Movement has also been increased so the flags are visibly active rather than slow.


## Independent Flag Physics — Final

- 250 flags are separate sprites, not one combined ball.
- Flags start distributed throughout the interior of the circle.
- Every flag has its own position and velocity.
- There is no central attraction and no orbital movement.
- Flags move at a medium-fast ball-like speed.
- Flag-to-flag contact produces elastic bouncing and separation.
- A flag touching the solid circle wall is reflected back inside.
- The rotating gap is the only place where a flag may leave.
- Entering the gap does not immediately eliminate it.
- The flag is eliminated only after its body is actually outside the circle.
- No HP/collision damage is used for elimination.


## Movement Speed — 65% Target

The flag movement has been increased to approximately the requested 60–70% level.

- Initial speed: approximately 105–145 px/s
- Normal maximum speed: 180 px/s
- Boost maximum speed: 220 px/s
- Reduced velocity damping so flags retain momentum
- Flags remain independent individual objects
- Solid wall still causes a bounce
- The rotating gap remains the only exit
- A flag is eliminated only after it actually leaves the circle


## Arena Size — Fixed

The circular arena is now fixed at its original size for the entire battle.

- No shrinking over time.
- No storm-based radius reduction.
- The rotating gap continues to move.
- Flags bounce from the fixed solid boundary.
- Flags can leave only through the gap.


## 30-Second Match

- The circle remains fixed-size.
- Every flag maintains the same movement speed from start to finish.
- Normal movement is held at 175 px/s.
- The gap is widened and rotates continuously.
- The battle has a hard 30-second broadcast duration.
- The winner is resolved at the 30-second mark, so the match does not continue indefinitely.


## Final Speed Rule

There is no time limit.

Every flag keeps the same fast movement speed for the entire battle:
- Normal constant speed: 190 px/s
- No acceleration over time
- No slowdown over time
- No 30-second forced finish
- Battle continues until only one flag remains

# world-flags-battle-250

