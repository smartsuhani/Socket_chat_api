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
var multer = require('multer');
var twilioClient = require('twilio')(
    'AC3b33267f212a5035780b89a5aab9e3be',
    '686f4ccbd6561d7ff7df6153434bd493'
);
var app = express();
var webport = 8085;
var sql = require('./sql');

var number_otp = {};

app.set('secret', 'token1234567');
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        req.body.path = "./uploads/";
        callback(null, './uploads/');
    },
    filename: function (req, file, callback) {
        console.log(file);
        var file1 = file.originalname.split(".");
        req.body.file = file1[0] + "_" + Date.now() + "." + file1[file1.length - 1];
        callback(null, req.body.file);
    }
});

var upload = multer({storage: storage}).array('file', 10);

// app.get('/', function (req, res) {
//     // console.log(res.send({msg:"success"}));
//     sql.executeSql("INSERT INTO usergroups(group_name,created_by) VALUES('abcd',8454644)", function (err, data) {
//         if (err) {
//             res.send({msg: err});
//         } else {
//             res.send({group_id: data["insertId"]});
//         }
//     });
// });

app.post('/register', function (req, res) {
    var num = req.body.userId;
    var q = "SELECT * FROM user WHERE user_id = " + num;
    sql.executeSql(q, function (err, data) {
        if (err) {
            res.send({err: "something went wrong try again later!"});
        } else {
            if (data.length > 0) {
                res.send({msg: "number already registered"});
            } else {
                var otp = parseInt(Math.random() * (999999 - 100000) + 100000);
                twilioClient.messages.create({
                    from: '19734335947',
                    to: "+"+num.toString(),
                    body: otp.toString()+" Your Verification OTP."
                }, function(err, message) {
                    if(err) {
                        console.error("error msg "+err.message);
                    } else {
                        var userobj = {
                            number: num,
                            otp: otp
                        };
                        number_otp["user"+num.toString()] = userobj;
                        res.send({resp: "success"});
                    }
                });
            }
        }
    });
});

app.post('/verification',function (req,res) {
    var otp = req.body.onetimepassword;
    var num = req.body.userId;
    console.log(req.body);
    console.log(number_otp);
    if (number_otp["user "+num.toString()].otp == parseInt(otp)) {
        res.send({resp: "success"});
        var newuser = "INSERT INTO user (user_id,nick_name,status_user,profileimage,devicetoken,devicetype,lastseen,country,time_zone) VALUES("+num+",'"+num+"','hi there i am on chat app!','./default_pic/default-user.png','')";
        sql.executeSql(newuser,function (err,data) {
            if (err) {

            } else {

            }
        });
    } else {
        res.send({resp: "failed"});
    }
});

app.post('/profilecreation',function (req,res) {

});

app.post('/upload', function (req, res) {
    upload(req, res, function (err) {
        if (err) {
            console.log('Error Occured');
            return;
        }
        console.log("hello  :" + req.body.file);
        res.end('Your File Uploaded');
        console.log('Photo Uploaded');
    });
});

var webserver = app.listen(webport, function () {
    console.log("https://" + webserver.address().address + ":" + webserver.address().port);
});
/**
 * Global variables
 */
// entire message history
// list of currently connected clients (users)
var clients = new Array();
var users = new Array();
// Array with some colors
var colors = ['red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange'];
// ... in random order
colors.sort(function (a, b) {
    return Math.random() > 0.5;
});

var server = http.createServer(function (request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function () {
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
wsServer.on('request', function (request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // accept connection
    var connection = request.accept(null, request.origin);
    var index = clients.push(connection) - 1;
    connection["userIndex"] = index;
    var userName = false;
    var userColor = false;
    var hold_group_id;

    console.log((new Date()) + ' Connection accepted.');

    // send back chat history


    // user sent some message
    connection.on('message', function (message) {
        var a = Buffer(message.binaryData);
        var packet = JSON.parse(a.toString('utf8'));
        console.log(packet);

        if (packet.type == "initConnection") {
            var userq = "SELECT * FROM user WHERE user_id = " + packet.senderId;
            sql.executeSql(userq, function (err, data) {
                if (err) {
                    connection.send(JSON.stringify({type: "error", err: "something went wrong!"}));
                    connection.close();
                } else {
                    if (data.length == 0) {
                        connection.send(JSON.stringify({type: "authErr", reply: "unauthorized User!"}));
                        connection.close();
                    } else {
                        users[connection.userIndex] = data[data.length - 1].user_id;
                        connection.send(JSON.stringify({type: "connected", reply: "success"}));
                        var msgquery = "SELECT * FROM chat WHERE receiver_id = " + packet.senderId + " AND status = 0";
                        sql.executeSql(msgquery, function (err, data) {
                            if (err) {
                                connection.send(JSON.stringify({type: "error", err: "something went wrong!"}));
                            } else {
                                var status = false;
                                if (data.length > 0) {
                                    connection.send(JSON.stringify({type: 'message', data: data}));
                                    status = true
                                }
                                if (status) {
                                    var q = "UPDATE chat set status = 1 WHERE receiver_id = " + packet.senderId;
                                    sql.executeSql(q, function (err, data1) {
                                        if (err) {
                                            console.log("error updating!");
                                        } else {
                                            var msg;
                                            for (msg in data) {
                                                var rec;
                                                var sent = false;
                                                for (rec in users) {
                                                    if (users[rec] == msg.sender_id) {
                                                        clients[rec].send(JSON.stringify({type: "msgAck", msgAck: 1, senderId:packet.senderId}));
                                                        sent = true;
                                                    }
                                                }
                                                if (sent) {
                                                    sql.executeSql("UPDATE chat set status = 2 WHERE receiver_id = " + packet.senderId + "sender_id = " + msg.sender_id,function (err,data) {
                                                        if (err) {

                                                        } else {

                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        });
                        var ackquery = "SELECT * FROM chat WHERE sender_id = "+packet.senderId+" AND (status = 1 OR status = 3)";
                        sql.executeSql(ackquery,function (err,data) {
                            if (err) {

                            } else {
                                console.log(data);
                                if (data.length > 0 ) {
                                    var ack;
                                    for (ack in data) {
                                        if (ack.status == 1) {
                                            connection.send(JSON.stringify({type: "msgAck", msgAck: 1, senderId: ack.receiver_id}));
                                        } else if (ack.status == 3) {
                                            connection.send(JSON.stringify({type: "msgAck",msgAck: 3, senderId: ack.receiver_id}));
                                        }
                                    }
                                    sql.executeSql("UPDATE chat SET status = IF(status = 1,2,IF(status = 3,4,status)) WHERE sender_id = "+users[index],function (err,data) {
                                        if (err) {

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

        if (packet.type == "contactCheck") {
            var contacts = packet.contacts;
            var contact;
            var checkedContacts = {};
            for (contact in contacts) {
                var query = "SELECT * FROM user WHERE user_id = "+contact.user_id;
            }
        }

        if (packet.type == "readMsgAck") {
            var query = "UPDATE chat set status = 3 WHERE receiver_id = " + users[index] + " AND sender_id = "+packet.senderId;
            sql.executeSql(query, function (err, data) {
                if (err) {
                    console.log("Error storing message to database");
                }
            });
            var obj = {
                time: (new Date()).getTime(),
                senderId: users[index],
                type: 'msgAck',
                msgAck: 3
            };
            // history.push(obj);

            var sent = false;
            // send message to receiver
            var json = JSON.stringify(obj);
            var rec;
            for (rec in users) {
                console.log("outer " + rec);
                if (users[rec] == packet.senderId) {
                    console.log("inner " + rec);
                    clients[rec].send(json);
                    sent = true;
                    break;
                }
            }
            if (sent) {
                var query = "UPDATE chat set status = 4 WHERE receiver_id = " + users[index] + " AND sender_id = "+packet.senderId;
                sql.executeSql(query, function (err, data) {
                    if (err) {
                        console.log("Error storing message to database");
                    }
                });
            }
            connection.send(JSON.stringify({type: "msgAck", msgAck: true}));
        }

        if (packet.type == "createGroup") {

            var createdBy = packet.senderId;
            sql.executeSql("INSERT INTO usergroups(group_name,created_by) VALUES(' '," + createdBy + ")", function (err, data) {
                if (err) {
                    connection.send(JSON.stringify({msg: "something went wrong!"}));
                } else {
                    connection.send(JSON.stringify({groupId: data["insertId"]}));
                    hold_group_id = data["insertId"];
                    sql.executeSql("INSERT INTO groupmap(user_id,group_id,admin) VALUES(" + createdBy + "," + group_id + "," + a["admin"] + ")",function (err,data) {
                        if(err) {

                        } else {

                        }
                    })
                }
            });

        }

        if (packet.type == "groupcreationcancel") {
            sql.executeSql("DELETE FROM usergroups WHERE group_id = " + hold_group_id, function (err, data) {
                if (err) {

                } else {
                    console.log("deleted data :" + data);
                    connection.send(JSON.stringify({msg: "group id deleted!", type: "groupCancel"}));
                }
            });
        }

        if (packet.type == "updateGroup") {
            var group_id = hold_group_id;
            var complete = false;
            sql.executeSql("UPDATE usergroups SET group_name = '" + packet.groupName + "' WHERE group_id = " + group_id, function (err, data) {
                if (err) {
                    connection.send(JSON.stringify({error: "error while updating group!"}));
                } else {
                    connection.send(JSON.stringify({msg: "group update successfully!"}));
                    for (var a in packet.memberList) {
                        var q1 = "INSERT INTO groupmap(user_id,group_id,admin) VALUES(" + a["user_id"] + "," + group_id + "," + a["admin"] + ")";
                        sql.executeSql(q1, function (err, data) {
                            if (err) {
                            } else {
                                var q2 = "INSERT INTO groupmessage (sender_id,group_id,message,delivered_to,read_by) VALUE("+packet.senderId+","+group_id+",'"+packet.senderId+" added "+a["user_id"]+"','','')"
                                sql.executeSql(q2,function (err,data) {
                                    if (err) {
                                    } else {
                                        for (rec in users) {
                                            if (users[rec] == a["user_id"]) {
                                                console.log("inner " + rec);
                                                clients[rec].send(json);
                                                sent = true;
                                            } else {

                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                    if(complete){
                        // sql.executeSql();
                    }
                }
            });
        }

        if (packet.type == "groupmessage") {
            var obj = {
                data: [{
                    time: Date(),
                    message: packet.message,
                    sender_id: packet.senderId,
                    group_id: packet.groupId
                }],
                type: 'message'
            };
            // history.push(obj);
            var sent = false;
            // send message to receiver
            var json = JSON.stringify(obj);
            var rec;
            sql.executeSql("SELECT user_id FROM groupmap WHERE group_id = " + packet.groupId, function (err, data) {
                if (err) {

                } else {
                    sql.executeSql("INSERT INTO groupmessage(sender_id,group_id,message,delivered_to,read_by) VALUES("+packet.senderId+","+packet.groupId+",'"+packet.message+"','','')",function (err,data) {
                        if (err) {

                        } else {
                            for (rec in users) {
                                var id;
                                for (id in data) {
                                    if (users[rec] == id) {
                                        console.log("inner " + rec);
                                        clients[rec].send(json);
                                        sent = true;
                                        sql.executeSql("SELECT delivered_to FROM groupmessage WHERE msg_id = "+data["insertId"],function (err,data) {
                                            if (err) {

                                            } else {
                                                if (data["delivered_to"] == '') {
                                                    data["delivered_to"] += users[rec].toString();
                                                } else {
                                                    data["delivered_to"] += ","+users[rec].toString();
                                                }
                                                sql.executeSql("UPDATE groupmessage SET delivered_to = '"+data["delivered_to"]+"' WHERE msg_id = "+data["insertId"],function (err,data) {

                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }

        if (packet.type == "message") {

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
            console.log(users);
            for (rec in users) {
                if (users[rec] == packet.recieverId) {
                    console.log("inner " + rec);
                    clients[rec].send(json);
                    sent = true;
                }
            }

            if (sent === true) {
                var query = "INSERT INTO chat (sender_id,receiver_id,message,status,time) VALUES(" + packet.senderId + "," + packet.recieverId + ",'" + packet.message + "'," + 2 + ",'" + Date() + "')";
                sql.executeSql(query, function (err, data) {
                    if (err) {
                        console.log("Error storing message to database");
                    } else {
                        connection.send(JSON.stringify({type: "msgAck", msgAck: 1, senderId:packet.recieverId}));
                    }
                });
            } else {
                var query = "INSERT INTO chat (sender_id,receiver_id,message,status,time) VALUES(" + packet.senderId + "," + packet.recieverId + ",'" + packet.message + "'," + 0 + ",'" + Date() + "')";
                sql.executeSql(query, function (err, data) {
                    if (err) {
                        console.log("Error storing message to database");
                    }else {
                        connection.send(JSON.stringify({type: "msgAck", msgAck: 0, senderId:packet.recieverId}));
                    }
                });
            }
        }
    });

    // user disconnected
    connection.on('close', function (connection) {
        console.log((new Date()) + " Peer " + users[index] + " disconnected.");
        // remove user from the list of connected clients
        var lastseenQ = "UPDATE user SET lastseen = '" + Date() + "' WHERE user_id = " + users[index];
        sql.executeSql(lastseenQ, function (err, data) {
            if (err) {
                console.log("Error updating user lastseen to database");
            } else {
                console.log(data);
                // remove user from the list of connected clients
                clients.splice(index, 1);
                // push back user's color to be reused by another user
                colors.push(userColor);
                users = users.filter(function (x) {
                    return x != users[index];
                });
            }
        });
    });

});