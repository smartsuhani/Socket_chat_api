
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

app.post('/register',function (req,res) {
    var num = req.body.userId;
    var q = "SELECT * FROM user WHERE user_id = "+num;
    sql.executeSql(q,function (err,data) {
        if (err) {
            res.send({});
        }
    });
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


    // user sent some message
    connection.on('message', function(message){
        var a = Buffer(message.binaryData);
        var packet = JSON.parse(a.toString('utf8'));
        console.log(packet);

        if (packet.type == "initConnection") {
            var userq = "SELECT * FROM user WHERE user_id = "+packet.senderId;
            sql.executeSql(userq , function (err,data) {
                if (err) {
                    connection.send(JSON.stringify({type: "error",err : "something went wrong!"}));
                    connection.close();
                } else {
                    if (data.length == 0) {
                        connection.send(JSON.stringify({type:"authErr",reply:"unauthorized User!"}));
                        connection.close();
                    } else {
                        users[connection.userIndex] = data[data.length - 1].user_id;
                        connection.send(JSON.stringify({type:"connected",reply:"success"}));
                        var msgquery = "SELECT * FROM chat WHERE receiver_id = "+packet.senderId+" AND status = 0";
                        sql.executeSql(msgquery,function (err,data) {
                            if (err) {
                                connection.send(JSON.stringify({type: "error",err : "something went wrong!"}));
                            } else {
                                var status = false;
                                if (data.length > 0) {
                                    connection.send(JSON.stringify( { type: 'message', data: data} ));
                                    status = true
                                }
                                if (status) {
                                    var q = "UPDATE chat set status = 1 WHERE receiver_id = "+packet.senderId;
                                    sql.executeSql(q,function (err,data) {
                                       if (err) {
                                           console.log("error updating!");
                                       } else {

                                       }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }

        if (packet.type == "readMsgAck") {
            var query = "UPDATE chat set status = 2 WHERE receiver_id = "+packet.senderId;
            sql.executeSql(query,function (err,data) {
                if (err) {
                    console.log("Error storing message to database");
                }
            });
            var obj = {
                time: (new Date()).getTime(),
                author: packet.senderId,
                type: 'readMsgAck'
            };
            // history.push(obj);

            var sent = false;
            // send message to receiver
            var json = JSON.stringify(obj);
            var rec;
            for (rec in users) {
                console.log("outer " + rec);
                if (users[rec] == packet.recieverId) {
                    console.log("inner " + rec);
                    clients[rec].send(json);
                    sent = true;
                    break;
                }
            }
            connection.send(JSON.stringify({type: "msgAck",msgAck:true}));
        }

        if (packet.type == "message"){
                var obj = {
                    data: [{
                        time: Date(),
                        message: packet.message,
                        sender_id: packet.senderId,
                        receiver_id: packet.recieverId
                    }],
                    type: 'message'
                };
                // history.push(obj);

                var sent = false;
                // send message to receiver
                var json = JSON.stringify(obj);
                var rec;
                for (rec in users) {
                    if (users[rec] == packet.recieverId) {
                        console.log("inner "+ rec);
                        clients[rec].send(json);
                        sent = true;
                    }
                }

                if (sent === true) {
                    var query = "INSERT INTO chat (sender_id,receiver_id,message,status,time) VALUES("+packet.senderId+","+packet.recieverId+",'"+packet.message+"',"+1+",'"+Date()+"')";
                    sql.executeSql(query,function (err,data) {
                        if (err) {
                            console.log("Error storing message to database");
                        } else {
                            connection.send(JSON.stringify({type: "msgAck",msgAck:sent}));
                        }
                    });
                } else {
                    var query = "INSERT INTO chat (sender_id,receiver_id,message,status,time) VALUES("+packet.senderId+","+packet.recieverId+",'"+packet.message+"',"+0+",'"+Date()+"')";
                    sql.executeSql(query,function (err,data) {
                        if (err) {
                            console.log("Error storing message to database");
                        }
                        connection.send(JSON.stringify({type: "msgAck",msgAck:sent}));
                    });
                }
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        console.log((new Date()) + " Peer " + users[index] + " disconnected.");
        // remove user from the list of connected clients
        var lastseenQ = "UPDATE user SET lastseen = '"+Date()+"' WHERE user_id = "+users[index];
        sql.executeSql(lastseenQ,function (err,data) {
            if (err) {
                console.log("Error storing message to database");
            } else {
                console.log(data);
            }
        });
        clients.splice(index, 1);
        // push back user's color to be reused by another user
        colors.push(userColor);
    });

});