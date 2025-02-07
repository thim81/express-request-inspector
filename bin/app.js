// app.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 4004;
const server = http.createServer(app);

// Create a WebSocket server attached to our HTTP server.
const wss = new WebSocket.Server({server});
let clients = [];

// When a new WebSocket client connects, add it to the clients array.
wss.on('connection', ws => {
    clients.push(ws);
    console.log(`Inspector WebSocket connected to ws://localhost:${PORT}`);
    console.log(`Inspector WebSocket clients connected: ${clients.length}`);

    // Listen for messages from each client and broadcast them.
    ws.on('message', message => {
        let parsedMessage;

        // Convert the message from Buffer to String
        if (Buffer.isBuffer(message)) {
            parsedMessage = message.toString('utf8'); // Decode Buffer to string
        } else {
            parsedMessage = message; // Already a string
        }
        // console.log('Message received on WS server:', parsedMessage);
        broadcast(parsedMessage);
    });

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
        console.log(`WebSocket client disconnected. Total clients: ${clients.length}`);
    });
});

// Function to broadcast captured data to all connected WebSocket clients.
function broadcast(data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            // console.log('Broadcasting to client:', json);
            client.send(json);
        }
    });
}

// Serve static files from the public folder (this includes our UI).
app.use(express.static('public'));

// Start the Express.js inspector server.
server.listen(PORT, () => {
    console.log(`Express Inspector is available on http://localhost:${PORT}`);
});
