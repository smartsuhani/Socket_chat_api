
var sql = require('./sql');
var user1 = require('./usersGlobal');
var userStatusReq = new Array();
var msgType = require('./MessageType').MessageType;

module.exports = {
    configure:function (wsServer) {
        wsServer.on('request', function (request) {
            console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

            // accept connection
            var connection = request.accept(null, request.origin);
            var index = user1.clients.push(connection) - 1;
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

                if (packet.type == msgType.initConnType) {
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
                                user1.users[index] = data[data.length - 1].user_id;
                                connection.send(JSON.stringify({type: "connected", reply: "success"}));
                                var i;
                                for (i in userStatusReq){
                                    if (user1.users[index] == userStatusReq[i]["user"]){
                                        var j;
                                        for (j in user1.users) {
                                            if (user1.users[j] == userStatusReq[i]["requester"]) {
                                                user1.clients[j].send(JSON.stringify({type: "userStatus",online:1}));
                                            }
                                        }
                                    } else if (user1.users[index] == userStatusReq[i]["requester"] && userStatusReq[i]["typing"]) {
                                        connection.send(JSON.stringify({type: "userStatus",online:2}));
                                    }
                                }
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
                                                        for (rec in user1.users) {
                                                            if (user1.users[rec] == msg.sender_id) {
                                                                user1.clients[rec].send(JSON.stringify({type: "msgAck", msgAck: 1, senderId:packet.senderId}));
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
                                        if (data.length > 0 ) {

                                            for (var i = 0 ; i < data.length ; i++) {
                                                if (data[i].status == 1) {
                                                    connection.send(JSON.stringify({type: "msgAck", msgAck: 1, senderId: data[i].receiver_id}));
                                                } else if (data[i].status == 3) {
                                                    connection.send(JSON.stringify({type: "msgAck",msgAck: 3, senderId: data[i].receiver_id}));
                                                }
                                            }
                                            sql.executeSql("UPDATE chat SET status = IF(status = 1,2,IF(status = 3,4,status)) WHERE sender_id = "+user1.users[index],function (err,data) {
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

                if (packet.type == msgType.readAckType) {
                    var query = "UPDATE chat set status = 3 WHERE receiver_id = " + user1.users[index] + " AND sender_id = "+packet.senderId;
                    sql.executeSql(query, function (err, data) {
                        if (err) {
                            console.log("Error storing message to database");
                        }
                    });
                    var obj = {
                        time: (new Date()).getTime(),
                        senderId: user1.users[index],
                        type: 'msgAck',
                        msgAck: 3
                    };
                    // history.push(obj);

                    var sent = false;
                    // send message to receiver
                    var json = JSON.stringify(obj);
                    var rec;
                    for (rec in user1.users) {
                        console.log("outer " + rec);
                        if (user1.users[rec] == packet.senderId) {
                            console.log("inner " + rec);
                            user1.clients[rec].send(json);
                            sent = true;
                        }
                    }
                    if (sent) {
                        var query = "UPDATE chat set status = 4 WHERE receiver_id = " + user1.users[index] + " AND sender_id = "+packet.senderId;
                        sql.executeSql(query, function (err, data) {
                            if (err) {
                                console.log("Error storing message to database");
                            }
                        });
                    }
                    // connection.send(JSON.stringify({type: "msgAck", msgAck: 5}));
                }

                if (packet.type == msgType.groupCreation) {

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

                if (packet.type == msgType.groupModify) {
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
                                                for (rec in user1.users) {
                                                    if (user1.users[rec] == a["user_id"]) {
                                                        console.log("inner " + rec);
                                                        user1.clients[rec].send(json);
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

                if (packet.type == msgType.groupMessage) {
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
                                    for (rec in user1.users) {
                                        var id;
                                        for (id in data) {
                                            if (user1.users[rec] == id) {
                                                console.log("inner " + rec);
                                                user1.clients[rec].send(json);
                                                sent = true;
                                                sql.executeSql("SELECT delivered_to FROM groupmessage WHERE msg_id = "+data["insertId"],function (err,data) {
                                                    if (err) {

                                                    } else {
                                                        if (data["delivered_to"] == '') {
                                                            data["delivered_to"] += user1.users[rec].toString();
                                                        } else {
                                                            data["delivered_to"] += ","+user1.users[rec].toString();
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

                if (packet.type == msgType.messageType) {

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
                    console.log("users: "+user1.users.length+"\nconnections: "+user1.clients.length);
                    for (rec in user1.users) {
                        if (user1.users[rec] == packet.recieverId) {
                            console.log("inner " + rec);
                            user1.clients[rec].send(json);
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

                if (packet.type == msgType.userstatus) {
                    var rec;
                    userStatusReq.push({requester:user1.users[index],user:packet.userId,typing: false});
                    var status = 0;
                    for (rec in user1.users) {
                        if (user1.users[rec] == packet.userId) {
                            status = 1;
                        }
                    }

                    connection.send(JSON.stringify({type:"userStatus",online: status}));
                }

                if (packet.type == msgType.userTyping) {
                    var user;
                    if (packet.typing == true) {
                        userStatusReq.push({requester:packet.userId,user:user1.users[index],typing: true});
                        for (user in user1.users) {
                            if (user1.users[user] == packet.userId) {
                                user1.clients[user].send(JSON.stringify({type:"userStatus",senderId:user1.users[index],online: 2}));
                            }
                        }
                    } else {
                        userStatusReq.filter(function (req) {
                            return req["user"] != user1.users[index] && req["typing"];
                        });
                        for (user in user1.users) {
                            if (user1.users[user] == packet.userId) {
                                user1.clients[user].send(JSON.stringify({type:"userStatus",senderId:user1.users[index],online: 3}));
                            }
                        }
                    }
                }

                if (packet.type == msgType.imageMessage) {}

                if (packet.type == msgType.videoMessage) {}

                if (packet.type == msgType.audioMessage) {}

                if (packet.type == msgType.groupAudioMessage) {}

                if (packet.type == msgType.groupImageMessage) {}

                if (packet.type == msgType.groupVideoMessage) {}

                if (packet.type == msgType.locationMessage) {}
            });

            // user disconnected
            connection.on('close', function (connection) {
                console.log((new Date()) + " Peer " + user1.users[index] + " disconnected.");
                // remove user from the list of connected user1.clients
                var lastseenQ = "UPDATE user SET lastseen = " + (new Date()).getTime() + " WHERE user_id = " + user1.users[index];
                if (user1.users[index] != undefined) {
                    sql.executeSql(lastseenQ, function (err, data) {
                        if (err) {
                            console.log("Error updating user lastseen to database");
                        } else {
                            // console.log(data);
                            // remove user from the list of connected user1.clients
                        }
                    });
                }
                var i;
                for (i in userStatusReq){
                    if (user1.users[index] == userStatusReq[i]["user"]){
                        var j;
                        for (j in user1.users) {
                            if (user1.users[j] == userStatusReq[i]["requester"]) {
                                user1.clients[j].send(JSON.stringify({type: "userStatus",online:0}));
                            }
                        }
                    }
                }

                userStatusReq = userStatusReq.filter(function (req) {
                    // return req["requester"] != user1.users[index];
                    if (req["user"] == user1.users[index] && req["typing"]) {
                        return true;
                    } else {
                        return req["requester"] != user1.users[index];
                    }
                });
                user1.clients.splice(index, 1);
                user1.users.splice(index, 1);

                // delete user1.clients[index];
                // delete user1.users[index];
            });

        });
    }
};