import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// CORS middleware to allow requests from any origin (specific to video streaming use case)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// define path to HLS folder
const hlsOutputDir = path.join(__dirname, 'hls_output');

// create a static network route to serve HLS files
app.use('/stream', express.static(hlsOutputDir));