Generate a test level JSON for the Marble Sorter game that demonstrates: $ARGUMENTS

The level must follow the exact format from CLAUDE.md (Level Data Format section):
```json
{
  "name": "...",
  "desc": "...",
  "mrbPerBox": 3,
  "sortCap": 6,
  "grid": [/* 49 cells (7x7), each null or an object */]
}
```

Requirements:
- Grid is 49 cells (7 columns x 7 rows, stored row-major)
- Each cell is `null` (empty) or a box object like `{"ci": 0, "type": "default"}`
- Color indices: 0=pink, 1=blue, 2=green, 3=yellow, 4=purple, 5=orange, 6=teal, 7=crimson
- Keep it simple and focused on showcasing the described mechanic
- Make sure marble counts balance (each color's total marbles must be sortable)
- `mrbPerBox` is marbles per standard box, `sortCap` is how many marbles each sort column holds

Output the JSON so I can paste it directly into the "Import Level" textarea in the game.
