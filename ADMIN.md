# Switching Color Scheme

The original color palette uses a warm orange cream color schematic:
    `[ #ffedb9, #fff8e1, #fff3d1, #ffcb56, #ffa259, #ff8f3d, #4a3b32, #6a5b52]`

To set the color scheme automatically via console lines,

```Shell
cat > switch-theme.js <<'EOF'
const fs = require('fs');
const file = 'app/globals.css';
let css = fs.readFileSync(file, 'utf8');  

const originalTheme = `@theme {
    /* Semantic backgrounds */
    --color-bg: #ffedb9;            /* Page background */
    --color-surface: #fff8e1;       /* Inputs / cards */
    --color-surface-hover: #fff3d1; /* Hover tint on surfaces */
    --color-card: #ffcb56;          /* Highlighted cards / Semantic actions */
    --color-primary: #ffa259;
    --color-primary-hover: #ff8f3d;
    /* Semantic text */
    --color-text: #4a3b32;          /* Primary text */
    --color-text-muted: rgba(74, 59, 50, 0.7);
    /* Brand background */
    --background-image-brand: linear-gradient(#4a3b32);
	--color-brand-title: #ffffff;
	--color-brand-subtitle: #dddddd;
}`;    

css = css.replace(/@theme\s*\{[\s\S]*?\}/, originalTheme);
fs.writeFileSync(file, css);
console.log('Using Orange Cream Theme');
EOF
node switch-theme.js
```

The client has requested a new color scheme revolving around pink and white:
    `[ #fce6e6, #f9d7d5, #f3c1c7, #ba7f85]`

To set the color scheme automatically via console lines,

```Shell
cat > switch-theme.js <<'EOF'
const fs = require('fs');
const file = 'app/globals.css';
let css = fs.readFileSync(file, 'utf8');  

const pinkTheme = `@theme {
    /* Semantic backgrounds */
    --color-bg: #fce6e6;            /* Page background */
    --color-surface: #f9d7d5;       /* Inputs / cards */
    --color-surface-hover: #f3c1c7; /* Hover tint on surfaces */
    --color-card: #ba7f85;          /* Highlighted cards / Semantic actions */
    /* Semantic actions */
    --color-primary: #ba7f85;     
    --color-primary-hover: #a66b71;
    /* Semantic text */
    --color-text: #000000;          /* Primary text */
    --color-text-muted: #222222;
    /* Brand gradient — bg-brand */
    --background-image-brand: linear-gradient(#ffffff);
    --color-brand-title: #000000;
	--color-brand-subtitle: #000000;
}`;  

css = css.replace(/@theme\s*\{[\s\S]*?\}/, pinkTheme);
fs.writeFileSync(file, css);
console.log('Using Pink Theme');
EOF
node switch-theme.js
```
