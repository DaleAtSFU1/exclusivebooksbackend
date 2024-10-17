# Use an official Node.js runtime as a parent image
FROM node:14-alpine

# Set the working directory inside the container
WORKDIR /exclusivebooksbackend

# Copy package.json and tsconfig.json to leverage Docker caching
COPY package*.json ./
COPY tsconfig.json .

# Install dependencies
RUN npm install

# Install TypeScript globally
RUN npm install typescript -g

# Copy the rest of the application code
COPY . .

# Compile TypeScript code
RUN tsc

# Expose the port the app will run on
EXPOSE 8080

# Set the environment variable for the port (if needed)
ENV PORT=8080

# Start the Node.js application
ENTRYPOINT ["node", "/exclusivebooksbackend/build/server.js"]