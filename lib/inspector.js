// inspector.js

const textBody = require('body');
const jsonBody = require('body/json');
const formBody = require('body/form');
const anyBody = require('body/any');
const WebSocket = require('ws');


// - Web Socket connection setup

// Use the following URL to connect to the Inspector UI WebSocket server.
// You can override it via the INSPECTOR_WS_URL environment variable.
let wsClient;
let reconnectInterval = 5000; // 5 seconds retry interval
let retryCount = 0;
let maxRetries = 10;
let wsUrl;

function connectWebSocket(url) {
    wsUrl = url || process.env.INSPECTOR_WS_URL || 'ws://localhost:4004';

    if (retryCount >= maxRetries) {
        console.error(`Reached max retry limit (${maxRetries}). Stopping reconnection attempts.`);
        return;
    }

    console.log(`Connecting to Inspector WebSocket at ${wsUrl} (Attempt ${retryCount + 1}/${maxRetries})...`);
    wsClient = new WebSocket(wsUrl);

    wsClient.on('open', () => {
        console.log(`Inspector WebSocket connected to ${wsUrl}`);
        retryCount = 0; // Reset retry count on successful connection
    });

    wsClient.on('close', () => {
        console.error('Inspector WebSocket connection lost.');
        retryCount++;
        if (retryCount < maxRetries) {
            console.log(`Reconnecting in ${reconnectInterval / 1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
            setTimeout(connectWebSocket, reconnectInterval);
        } else {
            console.error(`Max retries reached. Inspector WebSocket will not reconnect.`);
        }
    });

    wsClient.on('error', (err) => {
        console.error(`Inspector WebSocket error:`, err);
        wsClient.close();
    });
}

// Initial WebSocket connection
connectWebSocket();

// - Express Request / Response middleware

const ContentTypes = {
    TEXT_PLAIN: 'text/plain',
    APPLICATION_FORM: 'application/x-www-form-urlencoded',
    APPLICATION_JSON: 'application/json'
};

/**
 * Parse the request body based on content type.
 */
function parseRequestBody(contentType, req, res, options) {
    let bodyParser;
    switch (contentType) {
        case ContentTypes.TEXT_PLAIN:
            bodyParser = new Promise(resolve => textBody(req, (err, body) => resolve(body)));
            break;
        case ContentTypes.APPLICATION_FORM:
            bodyParser = new Promise(resolve => formBody(req, {}, (err, body) => resolve(body)));
            break;
        case ContentTypes.APPLICATION_JSON:
            bodyParser = new Promise(resolve => jsonBody(req, res, (err, body) => resolve(body)));
            break;
        default:
            bodyParser = new Promise(resolve => anyBody(req, res, {}, (err, body) => resolve(body)));
            break;
    }
    return bodyParser
}

/**
 * Intercept the response so that we can capture its body.
 */
function parseResponseBody(res, options, next) {
    return new Promise((resolve, reject) => {
        const originalWrite = res.write;
        const originalEnd = res.end;
        const chunks = [];

        res.write = function (chunk, ...args) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            originalWrite.apply(res, [chunk, ...args]);
        };

        res.end = function (chunk, ...args) {
            if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            originalEnd.apply(res, [chunk, ...args]);
        };

        res.once('finish', () => {
            const responseBody = Buffer.concat(chunks).toString('utf8');
            // (You could compute latency here if desired.)
            resolve(responseBody);
        });

        next();
    });
}

/**
 * Construct the full URL.
 */
function parseUrl(req) {
    const protocol = req.protocol || req.get('X-Forwarded-Protocol') || 'http';
    const host = req.hostname || req.get('host');
    const path = req.originalUrl || req.url;
    return `${protocol}://${host}${path}`;
}

/**
 * Extract request meta-data.
 */
function parseRequestMeta(req) {
    const method = req.method;
    const headers = req.headers;
    const host = req.get('host');
    const clientIp = req.headers['x-forwarded-for'] || req.ip;

    // Extract endpoint and query parameters from the full URL
    const fullUrl = parseUrl(req);
    const urlObj = new URL(req.originalUrl, fullUrl);
    const endpoint = urlObj.pathname; // Extract only the path part
    const queryParams = Object.fromEntries(urlObj.searchParams.entries()); // Convert search params to an object

    return { method, headers, host, clientIp, endpoint, queryParams };
}

/**
 * Extract response meta-data.
 */
function parseResponseMeta(res) {
    const headers = res.getHeaders ? res.getHeaders() : res._headers;
    const status = res.statusCode;
    return {headers, status};
}

/**
 * The “capture” middleware.
 * It returns a promise that resolves (after the response is finished)
 * with an object containing the URL, request details, response details, and latency.
 */
function capture(req, res, next) {
    const start = Date.now();
    const contentType = req.get('content-type') || '';
    let data = {url: '', endpoint: '', request: {}, response: {}, latency: 0};

    return parseRequestBody(contentType, req, res, {})
        .then(payload => {
            data.request = Object.assign({}, data.request, {payload});
            return parseResponseBody(res, {}, next);
        })
        .catch(e => {
            next();
            return Promise.reject(e);
        })
        .then(payload => {
            data.response = Object.assign({}, data.response, {payload});
            data.url = parseUrl(req);
            const requestMeta = parseRequestMeta(req);
            data.endpoint = requestMeta.endpoint;
            data.request.queryParams = requestMeta.queryParams;
            Object.assign(data.request, requestMeta);

            return data;
        })
        .then(data => {
            Object.assign(data.response, parseResponseMeta(res));
            data.latency = Date.now() - start;
            return data;
        })
        .then(data => {
            // Automatically broadcast the captured data via WebSocket.
            if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                // console.log('Inspector is sending captured data to WS server:', JSON.stringify(data));
                wsClient.send(JSON.stringify(data));
            } else {
                // console.error('Inspector WS client not open. Data not sent.');
            }
            return data;
        });
}

module.exports = {
    capture,
    connectWebSocket,
    ContentTypes,
    parseRequestBody,
    parseResponseBody,
    parseUrl,
    parseRequestMeta,
    parseResponseMeta
};
