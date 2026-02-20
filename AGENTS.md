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
var conversationHistory = [];

// GOOD - from documented function
var slots = generateTimeSlots(); // No @type needed

// BAD - NO @type
var selectedModel = null;
var conversationHistory = [];
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

### Script Loading Order (in index.html)
```
openrouter.js  →  prompt.js  →  storage.js  →  ui.js  →  agent.js
```

### File Purposes
- `index.html`: Main HTML with Bootstrap 5, inline styles, script loading
- `openrouter.js`: OpenRouter API calls (fetchModels, fetchBalance, generateImage)
- `prompt.js`: System prompt constant
- `storage.js`: OPFS storage (preferences, conversations, images)
- `ui.js`: DOM manipulation and UI updates
- `agent.js`: Main orchestration and event handling
- `sw.js`: Service Worker for offline support

### Dependencies
- Bootstrap 5 via CDN (CSS in `<head>`, JS before `</body>`)
- No ES6 imports - use vanilla JS with `<script src="...">` tags

## 5. Code Formatting

- **Indentation**: 4 spaces
- **Line Length**: <140 characters
- **Semicolons**: Always use at end of statements
- **Braces**: Always use for blocks (`if (cond) { ... }`)
- **Spacing**: One space around operators, after commas, no trailing spaces
- **Blank Lines**: One between functions, two between major sections
- **Quotes**: Single quotes for strings, double for HTML attributes
- **Declarations**: Use `var` (legacy codebase - maintain consistency)

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

## 10. HTML/CSS & Bootstrap

- **Framework**: Bootstrap 5 via CDN
- **Custom CSS**: Inline `<style>` in index.html for layout-specific needs
- **Modals**: Bootstrap modals with `data-bs-dismiss`
- **Accessibility**: Add `aria-label` for inputs/buttons without labels

## 11. Security & Best Practices

- **Input Sanitization**: Trim/validate all user inputs
- **XSS Prevention**: Use `textContent` not `innerHTML` with user data
- **No Secrets**: Never hardcode API keys; use user input or storage
- **PWA**: Service Worker handles offline caching

## 12. Version Control

- Agents must NEVER commit, push, or perform git operations
- Only make code changes; user handles all version control

## Code Review Checklist

Before submitting any code changes, verify:

- [ ] Every function has JSDoc with @param, @returns
- [ ] Every function that throws has @throws
- [ ] Every inline array `[]` has @type comment
- [ ] Every inline object `{}` has @type comment
- [ ] No single-letter variable names (except trivial loop counters)
- [ ] No abbreviations in names
- [ ] Functions under 100 lines
- [ ] All HTML IDs use kebab-case

By following these guidelines, agents maintain a clean, maintainable, and well-documented codebase.
