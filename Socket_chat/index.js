
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

// Port where we'll run the websocket server
var webSocketsServerPort = 1337;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');

var app = express();
var webport = 8085;
var sql = require('./sql');

app.set('secret', 'token1234567');
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/',function (req,res) {
    console.log(res.send({msg:"success"}));
});

var webserver = app.listen(webport,function () {
    console.log("https://"+webserver.address().address+":"+webserver.address().port);
})
/**
 * Global variables
 */
// entire message history
var history = new Array();
// list of currently connected clients (users)
var clients = new Array();
var users = new Array();
// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. To be honest I don't understand why.
    httpServer: server
});

// This callback function is called every time someone tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // accept connection
    var connection = request.accept(null, request.origin);
    var index = clients.push(connection) - 1;
    connection["userIndex"] = index;
    var userName = false;
    var userColor = false;

    console.log((new Date()) + ' Connection accepted.');

    // send back chat history
    if (history.length > 0) {
        connection.sendUTF(JSON.stringify( { type: 'history', data: history} ));
    }

    // user sent some message
    connection.on('message', function(message){
        var a = Buffer(message.binaryData);
        var packet = JSON.parse(a.toString('utf8'));
        console.log(packet);

        if (packet.type == "initConnection") {
            users[connection.userIndex] = packet.senderId;
            connection.send(JSON.stringify({reply:"success"}));
        }
        if (packet.type == "message"){
                var obj = {
                    time: (new Date()).getTime(),
                    text: packet.message,
                    author: packet.senderId,
                    type: 'message'
                };
                // history.push(obj);

                var sent = false;
                // send message to receiver
                var json = JSON.stringify(obj);
                var rec;
                for (rec in users) {
                    if (users[rec] == packet.recieverId) {
                        clients[rec].send(json);
                        sent = true;
                    }
                }

                if (sent === true) {
                    var query = "INSERT INTO chat (sender_id,receiver_id,message,status,time) VALUES("+packet.senderId+","+packet.recieverId+",'"+packet.message+"',"+1+",'"+Date()+"')";
                    sql.executeSql(query,function (data,err) {
                        if (err) {
                            console.log("Error storing message to database");
                        }
                        connection.send(JSON.stringify({msgAck:sent}));
                    });
                } else {
                    var query = "INSERT INTO chat (sender_id,receiver_id,message,status,time) VALUES("+packet.senderId+","+packet.recieverId+",'"+packet.message+"',"+0+",'"+Date()+"')";
                    sql.executeSql(query,function (data,err) {
                        if (err) {
                            console.log("Error storing message to database");
                        }
                        connection.send(JSON.stringify({msgAck:sent}));
                    });
                }
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userColor);
        }
    });

});