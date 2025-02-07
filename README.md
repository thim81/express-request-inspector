# Express Request/Response Inspector

**Express Request/Response Inspector** is an NPM package that provides middleware for Express applications to capture and inspect every incoming request and outgoing response. It also includes a built‑in Inspector UI (accessible at [http://localhost:4004](http://localhost:4004)) where you can view details in real time—similar in spirit to Ngrok’s inspector.

## Features

- **Middleware**: Intercepts HTTP requests and responses.
- **Real-time UI**: Uses WebSockets to broadcast data to an inspector UI.
- **Built-in Inspector Server**: The UI is served on port 4004.
- **Easy Integration**: Simply add the middleware to your Express app.

## Installation

Install the package via npm:

```bash
npm install express-request-response-inspector
```

## Usage

1. Integrate the Inspector Middleware into Your Express Application
   In your Express application, require the package and use the middleware. For example:

    ```js
    // app.js
    const express = require('express');
    const inspector = require('express-request-inspector').capture;
    
    const app = express();
    
    // Add the inspector middleware BEFORE your routes
    app.use((req, res, next) => {
        inspector(req, res, next)
            .then(data => {
                // Optionally, process the captured data (e.g., log it)
                console.log('Captured data:', data);
        })
        .catch(err => {
            console.error('Inspector error:', err);
            next(err);
        });
    });
    
    // Define your routes
    app.get('/', (req, res) => {
        res.send('Hello, world!');
    });
    
    // Start your Express server as usual
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Express app listening on port ${PORT}`);
    });
    ```

2. Run the Inspector UI
   The Inspector UI is provided as a separate command-line tool that serves the UI on port 4004. Once your app is running (and using the middleware), you can start the Inspector UI in another terminal:

   If you installed the package locally:
    
   ```bash
    npx express-request-inspector
   ```
   
   Or, if installed globally:
    
   ```bash
    express-request-inspector
   ```
   
   or as package.json script

   ```bash
   "scripts": {
    "inspector": "express-request-inspector"
   }
   ```
   
   Then open your browser to http://localhost:4004 to view the inspector interface.