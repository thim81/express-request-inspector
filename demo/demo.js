// demo.js
const express = require('express');
const inspector = require('../lib/inspector');

const app = express();

// (Optional) Define a custom Inspector Websocket
// inspector.connectWebSocket(ws://localhost:8989);

// Use Inspector middleware for all routes.
app.use((req, res, next) => {
    inspector.capture(req, res, next, { broadcast: true, print: true })
        .then(data => {
            // Log inspector object
            console.log('Captured:', data);
        })
        .catch(err => {
            console.error('Capture error:', err);
        });
});

// (Optional) You can add any standard middleware or routes below.

// A test route for demonstration.
app.get('/test', (req, res) => {
    res.json({message: 'This is a test endpoint.'});
});

// Start the server.
const PORT = process.env.PORT || 4005;
app.listen(PORT, () => {
    console.log(`Express Demo is available on http://localhost:${PORT}`);
});
