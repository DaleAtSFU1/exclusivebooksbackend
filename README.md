
# Exclusive Books Backend

## Overview

The Exclusive Books backend is a Node.js-based server application designed to manage book data and interact with external APIs and databases. The project is built with Express and TypeScript, with Sequelize ORM for database interaction.

## Features

- **Express.js**: Lightweight web framework for handling HTTP requests.
- **TypeScript**: Strongly typed JavaScript for better development experience.
- **Sequelize**: ORM for interacting with SQL databases.
- **Axios**: HTTP client for API requests.
- **Environment Configuration**: Managed with `dotenv`.

## Prerequisites

- Node.js (version 18 or higher)
- npm (Node package manager)

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/exclusivebooksbackend.git
   cd exclusivebooksbackend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file for environment variables (e.g., database credentials, API keys).

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. To start the production server:
   ```bash
   npm start
   ```

## Project Structure

- `src/`: Contains the source TypeScript files.
- `build/`: Contains the compiled JavaScript files.
- `node_modules/`: Contains the project dependencies.
- `server.js`: Main entry point for the server.

## Scripts

- `npm start`: Runs the application in production.
- `npm run dev`: Starts the development server with auto-reload.
- `npm run build`: Compiles TypeScript into JavaScript.

## License

This project is licensed under the ISC License.
