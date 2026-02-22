# AGENTS.md - Guidelines for Agentic Coding in LlmImageCreator

This file provides instructions for AI coding agents (e.g., opencode) working on the LlmImageCreator repository. It includes code style guidelines, conventions, and requirements for maintaining consistency. The project is a stand-alone HTML/JavaScript application for generating images interactively using OpenRouter.

**CRITICAL**: The existing codebase (agent.js, sw.js) is NON-COMPLIANT with JSDoc requirements. Agents must write NEW code that strictly follows these guidelines.

## 1. General Principles

- **Readability First**: Code should be self-explanatory. Use descriptive names and structures.
- **Modularity**: Keep functions small (<100 lines). One responsibility per function.
- **Security**: Never expose secrets. Validate user inputs.
- **Performance**: Optimize for client-side (e.g., avoid large loops; use efficient data structures like Maps/Sets).
- **Browser Compatibility**: Support modern browsers (Chrome, Firefox, Safari). Avoid polyfills unless necessary.
- **Code Functionality**: Agents must write fully functional, production-ready code unless the user explicitly requests stubs, placeholders, or incomplete implementations. Avoid TODO comments or non-working code segments—ensure all logic is complete and runnable.

## 2. Testing

- **Agents DO NOT run tests**: User performs all manual testing
- `./run_test_webserver.sh`: User starts local server at http://localhost:8001/
- No automated tests - manual browser testing only

## 3. JSDoc Requirements - MANDATORY

Every function and array/object declaration MUST have proper JSDoc documentation.

### Functions - REQUIRED Tags
- `@param` - All parameters with types
- `@returns` - Return type (even for void functions)
- `@throws` - Any errors thrown

```javascript
// GOOD
/**
 * Fetches all available models from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Array<Object>>} Array of model objects
 * @throws {Error} If API request fails
 */
function fetchModels(apiKey) { ... }

// BAD - NO JSDoc
function handleApiKeyEntry() { ... }
```

### Arrays/Objects - REQUIRED @type
- Every inline array `[]` or object `{}` needs `@type` JSDoc
- Exception: Variables assigned from well-documented function returns

```javascript
// GOOD
/** @type {Array<{role: string, content: string}>} */
const conversationHistory = [];

// GOOD - from documented function
const slots = generateTimeSlots(); // No @type needed

// BAD - NO @type
let selectedModel = null;
let conversationHistory = [];
```

### @typedef for Complex Types
```javascript
/**
 * @typedef {Object} ImageConfig
 * @property {string} imageSize - Image size (1K, 2K, 4K)
 * @property {string} aspectRatio - Aspect ratio (1:1, 16:9, etc)
 */
```

## 4. File Structure & Dependencies

### Module Loading (in index.html)
ES Modules loaded via `<script type="module" src="main.js"></script>`
main.js imports agent.js which then imports all other modules

### File Purposes
- `index.html`: Main HTML with Bootstrap 5, inline styles, script loading
- `main.js`: Application entry point, imports agent.js and calls init()
- `state.js`: Centralized state object (selectedModel, currentConversation, conversationHistory, isGenerating, deferredPrompt)
- `openrouter.js`: OpenRouter API calls (fetchModels, fetchBalance, generateImage)
- `prompt.js`: System prompt constants
- `storage.js`: OPFS storage (preferences, conversations, images)
- `ui.js`: DOM manipulation and UI updates
- `util.js`: Utility functions (generateRandomSeed, generateConversationTitle, getApiKey)
- `agent.js`: Main orchestration and event handling
- `sw.js`: Service Worker for offline support (non-module)

### Module Dependencies
- Bootstrap 5 via CDN (CSS in `<head>`, JS before `</body>`)
- All JS files use ES6 modules with `import`/`export`
- State managed in state.js, imported by ui.js and agent.js

### Import Chain
main.js → agent.js → (prompt.js, openrouter.js, storage.js, state.js, ui.js, util.js)

## 5. Code Formatting

- **Indentation**: 4 spaces
- **Line Length**: <140 characters
- **Semicolons**: Always use at end of statements
- **Braces**: Always use for blocks (`if (cond) { ... }`)
- **Spacing**: One space around operators, after commas, no trailing spaces
- **Blank Lines**: One between functions, two between major sections
- **Quotes**: Single quotes for strings, double for HTML attributes
- **Declarations**: Use `let` or `const` for all variable declarations MANDATORY

## 6. Naming Conventions

- **Variables/Functions**: camelCase (e.g., `parseCsvToObjects`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `OPENROUTER_BASE_URL`)
- **HTML IDs**: kebab-case (e.g., `api-key-input`)
- **Descriptive Names**: Avoid abbreviations
  - ❌ `p`, `a`, `tsStart`
  - ✅ `player`, `appointment`, `timeSlotStart`

## 7. Function Guidelines

- **Max 100 lines** per function (excluding comments)
- **Single Responsibility**: One function does one thing
- **Parameters**: Limit to <5; use objects for many params
- **Early Returns**: Use for clarity and reduced nesting
- **Arrow Functions**: Use for short callbacks only

```javascript
// BAD - 100+ lines doing multiple things
function submitAddPlayer() { /* ... */ }

// GOOD - split into smaller functions
function handleApiKeyEntry() { ... }
function handleGenerate() { ... }
```

## 8. Variables & Data Structures

- **Scope**: Minimize globals; use objects to group related data
- **Arrays**: Use literals `[]`, prefer Maps for key-value
- **Objects**: Use literals `{}`
- **Strings**: Template literals for interpolation `` `${var}` ``

## 9. Error Handling

- **Validation**: Check inputs early (`if (!apiKey) return;`)
- **Throws**: For critical errors; ALWAYS document with `@throws`
- **User Feedback**: Display errors via `displayError()` in UI
- **Logging**: Use `console.log` for debug only

## 10. Null Safety Patterns

Use modern JavaScript operators for clean null/undefined handling instead of explicit checks.

### Optional Chaining (`?.`)

**When to use**: Access properties or methods of objects that may be null/undefined
**Pattern**: Use `?.` instead of explicit `if` checks or ternaries

```javascript
// GOOD - Optional chaining
const resolution = entry.response.imageResolutions?.[index] ?? "1K";
const apiKey = STATE.currentConversation?.apiKey;

// BAD - Verbose checks
const resolution = entry.response.imageResolutions ? entry.response.imageResolutions[index] : "1K";
const apiKey = STATE.currentConversation && STATE.currentConversation.apiKey;
```

### Nullish Coalescing (`??`)

**When to use**: Provide fallback value only when left side is `null` or `undefined`
**Pattern**: `??` is safer than `||` (which also triggers on `false, 0, ""`)

```javascript
// GOOD - Nullish coalescing (only catches null/undefined)
const resolution = entry.response.imageResolutions?.[index] ?? "1K";

// AVOID - Logical OR (catches falsy values like 0, false, "")
const resolution = entry.response.imageResolutions?.[index] || "1K";
```

### Initialization with `??=`

**When to use**: Initialize arrays/objects only if they don't exist
**Pattern**: `??=` is shorthand for `x = x ?? default`

```javascript
// GOOD - Conditionally initialize
entry.response.imageResolutions ??= [];
entry.response.imageResolutions.push(resolution);
```

### Key Rule

**Prefer `?.` and `??` over explicit null checks**: These operators provide the same safety with cleaner, more readable code.

## 11. HTML/CSS & Bootstrap

- **Framework**: Bootstrap 5 via CDN
- **Custom CSS**: Inline `<style>` in index.html for layout-specific needs
- **Modals**: Bootstrap modals with `data-bs-dismiss`
- **Accessibility**: Add `aria-label` for inputs/buttons without labels

### DOM Insertions - MANDATORY

All DOM insertions MUST use HTML templates with `cloneNode(true)` and follow this exact pattern:

```html
<!-- conversation-item-template: Template for displaying a single conversation in the sidebar -->
<template id="conversation-item-template">
    <div class="conversation-item">
    [content goes here]
    </div>
</template>
```

```javascript
// GOOD - Correct template usage pattern
function addConversationItem(conversation) {
    const template = document.getElementById('conversation-item-template');
    const clone = template.content.cloneNode(true);
    const container = clone.firstElementChild; // Capture BEFORE adding to DOM
    container.textContent = conversation.title;
    document.getElementById('conversation-list').appendChild(clone);
    // Now 'container' is a reference to the element now in the DOM
    container.addEventListener('click', () => handleConversationClick(conversation.id));
}

// BAD - Incorrect patterns
function addConversationItem(conversation) {
    const div = document.createElement('div'); // No template
    div.textContent = conversation.title;
    document.getElementById('conversation-list').appendChild(div);
}
```

#### Template Requirements

1. **Every template must have a comment** describing what the template is for (placed on the line above the `<template>` tag)
2. **Templates must have a single interior div** - the template should contain exactly one root element (the `<div>` inside `<template>`)
3. **Capture reference before DOM insertion** - Always capture `clone.firstElementChild` BEFORE calling `appendChild`, `insertBefore`, or any method that adds the clone to the document
4. **Use the captured reference** for all subsequent DOM manipulations (adding event listeners, setting content, etc.)

## 12. Security & Best Practices

- **Input Sanitization**: Trim/validate all user inputs
- **XSS Prevention**: Use `textContent` not `innerHTML` with user data
- **No Secrets**: Never hardcode API keys; use user input or storage
- **PWA**: Service Worker handles offline caching

## 13. Version Control

- Agents must NEVER commit, push, or perform git operations
- Only make code changes; user handles all version control

## Code Review Checklist

Before submitting any code changes, verify:

- [ ] Every function has JSDoc with @param, @returns
- [ ] Every function that throws has @throws
- [ ] All variables use let or const (no var declarations)
- [ ] Every inline array `[]` has @type comment
- [ ] Every inline object `{}` has @type comment
- [ ] No single-letter variable names (except trivial loop counters)
- [ ] No abbreviations in names
- [ ] Functions under 100 lines
- [ ] All HTML IDs use kebab-case
- [ ] All DOM insertions use HTML templates with cloneNode(true)
- [ ] All templates have descriptive comments
- [ ] All templates have a single interior div
- [ ] References captured via clone.firstElementChild before DOM insertion

By following these guidelines, agents maintain a clean, maintainable, and well-documented codebase.
