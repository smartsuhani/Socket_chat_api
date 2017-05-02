"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

// Port where we'll run the websocket server
var webSocketsServerPort = 8001;

var webSocketServer = require('websocket').server;
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var apiRoutes = require('./apiRoutes');
var socketRoutes = require('./socketRoutes');

var app = express();
var webport = 8085;


app.set('secret', 'token1234567');
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());



var webserver = app.listen(webport,'192.168.200.15',function () {
    console.log("https://" + webserver.address().address + ":" + webserver.address().port);
});

var server = http.createServer(function (request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort,'192.168.200.15', function () {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. To be honest I don't understand why.
    httpServer: server
});

apiRoutes.configure(app);
socketRoutes.configure(wsServer);