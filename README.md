# SCA (Multi-Language Online Compiler)

SCA (formerly Codeezy) is a Competitive-Programming-Ready web platform that allows users to write, syntax-check, execute, and test code across multiple programming languages directly in their browser. It mimics the coding environments found on platforms like LeetCode and HackerRank.

## Features

- **Multi-Language Support**: Write and execute code in C, C++, Java, Python, JavaScript, TypeScript, Go, and Rust.
- **Premium Code Editor**: Powered by Monaco Editor (the core of VS Code) for syntax highlighting, auto-completion, and a native developer experience.
- **Competitive Programming Ready**: 
  - Provide custom `stdin` test cases.
  - Compare actual output against Expected Output.
  - Generates standard verdicts: *Accepted (AC)*, *Wrong Answer (WA)*, *Compilation Error (CE)*, *Runtime Error (RE)*, and *Time Limit Exceeded (TLE)*.
- **Interactive UI**: Features a resizable terminal panel, code download capability, and standard coding shortcuts.
- **Secure Backend Engine**: Includes strict rate limiting, 10-second execution timeouts, and temporary process isolation to prevent server crashes from malicious code or infinite loops.

##  Tech Stack

### Frontend
- **Framework**: React + Vite

- **Styling**: Vanilla CSS with modern UI/UX design and `lucide-react` for icons.

### Backend
- **Environment**: Node.js
- **Framework**: Express.js
- **Execution Engine**: Custom implementation using Node's `child_process` to spawn and manage native OS compilers.

## 📋 Prerequisites

To run this project locally, you will need:
- Node.js (v18 or higher)
- System Compilers installed and added to your OS `PATH` for the languages you intend to test (e.g., GCC/G++ for C/C++, JDK for Java, Python 3, Go, Rustc, etc.).

## 💻 Installation & Running

1. **Clone the repository** (if applicable):
   ```bash
   git clone <repository-url>
   cd "c platform"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Frontend (Vite)**:
   ```bash
   npm run dev
   ```

4. **Start the Backend Server**:
   Open a new terminal window and run:
   ```bash
   node server/index.js
   ```
   *(Note: Ensure your `server/index.js` contains the `app.listen()` method so the server actually starts receiving requests!)*

## 🌐 API Endpoints

The backend runs on `http://localhost:5000` and exposes the following endpoints:

- `POST /execute` — Receives `language`, `code`, and optional `input`. Compiles and executes the code, returning the output and execution time.
- `POST /parse` — Receives `language` and `code`. Performs a fast syntax check without executing the logic.
- `GET /health` — Simple health check to verify the API is online.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Enter` | Run Code |
| `Ctrl + Shift + Enter` | Parse / Syntax Check Code |
| `Ctrl + Shift + C` | Copy Terminal Output |


