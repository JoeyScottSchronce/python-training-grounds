# PythonMaster AI 🐍🤖

An interactive AI-powered platform designed to help you master Python programming through dynamic, hands-on coding challenges.

![PythonMaster AI](https://picsum.photos/seed/python/1200/600)

## 🚀 Features

- **AI-Generated Challenges**: Never run out of practice! Our AI tutor generates unique challenges tailored to specific Python topics.
- **Real-Time Grading**: Get instant feedback on your code. The AI analyzes your syntax, logic, and style.
- **Comprehensive Curriculum**:
  - **Fundamentals**: Variables, Loops, Conditionals, OOP, and more.
  - **Built-in Functions**: Master the standard library from `print()` to `memoryview()`.
  - **Modules**: Explore essential modules like `math`, `os`, `json`, and `asyncio`.
- **Difficulty Levels**: Choose between Beginner, Intermediate, and Advanced tracks.
- **Interactive Terminal UI**: A sleek, dark-themed environment inspired by modern code editors.
- **Progress Tracking**: Keep track of your recent activity and review previous submissions.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Engine**: [Google Gemini AI](https://ai.google.dev/) (via `@google/genai`)

## 🚦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Google Gemini API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/pythonmaster-ai.git
   cd pythonmaster-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**:
   Navigate to `http://localhost:3000` in your browser.

## 📖 How It Works

1. **Pick a Topic**: Select from the wide range of Python topics available on the dashboard.
2. **Solve the Challenge**: Read the AI-generated task and write your solution in the integrated code editor.
3. **Get Graded**: Click "Run & Grade" to send your code to the AI tutor.
4. **Learn & Iterate**: Review the feedback, check the reference solution if you're stuck, and move on to the next challenge!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the Python community.
