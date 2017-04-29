
var sql = require('./sql');

var clients = new Array();
var users = new Array();
var userStatusReq = new Array();

module.exports = {
    configure:function (wsServer) {
        wsServer.on('request', function (request) {
            console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

            // accept connection
            var connection = request.accept(null, request.origin);
            var index = clients.push(connection) - 1;
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
                                users[index] = data[data.length - 1].user_id;
                                connection.send(JSON.stringify({type: "connected", reply: "success"}));
                                var i;
                                for (i in userStatusReq){
                                    if (users[index] == userStatusReq[i]["user"]){
                                        var j;
                                        for (j in users) {
                                            if (users[j] == userStatusReq[i]["requester"]) {
                                                clients[j].send(JSON.stringify({type: "userStatus",online:1}));
                                            }
                                        }
                                    } else if (users[index] == userStatusReq[i]["requester"] && userStatusReq[i]["typing"]) {
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
                                        if (data.length > 0 ) {

                                            for (var i = 0 ; i < data.length ; i++) {
                                                if (data[i].status == 1) {
                                                    connection.send(JSON.stringify({type: "msgAck", msgAck: 1, senderId: data[i].receiver_id}));
                                                } else if (data[i].status == 3) {
                                                    connection.send(JSON.stringify({type: "msgAck",msgAck: 3, senderId: data[i].receiver_id}));
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
                    // connection.send(JSON.stringify({type: "msgAck", msgAck: 5}));
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
                    console.log("users: "+users.length+"\nconnections: "+clients.length);
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

                if (packet.type == "userstatus") {
                    var rec;
                    userStatusReq.push({requester:users[index],user:packet.userId,typing: false});
                    var status = 0;
                    for (rec in users) {
                        if (users[rec] == packet.userId) {
                            status = 1;
                        }
                    }

                    connection.send(JSON.stringify({type:"userStatus",online: status}));
                }

                if (packet.type == "typing") {
                    var user;
                    if (packet.typing == true) {
                        userStatusReq.push({requester:packet.userId,user:users[index],typing: true});
                        for (user in users) {
                            if (users[user] == packet.userId) {
                                clients[user].send(JSON.stringify({type:"userStatus",senderId:users[index],online: 2}));
                            }
                        }
                    } else {
                        userStatusReq.filter(function (req) {
                            return req["user"] != users[index] && req["typing"];
                        });
                        for (user in users) {
                            if (users[user] == packet.userId) {
                                clients[user].send(JSON.stringify({type:"userStatus",senderId:users[index],online: 3}));
                            }
                        }
                    }
                }
            });

            // user disconnected
            connection.on('close', function (connection) {
                console.log((new Date()) + " Peer " + users[index] + " disconnected.");
                // remove user from the list of connected clients
                var lastseenQ = "UPDATE user SET lastseen = " + (new Date()).getTime() + " WHERE user_id = " + users[index];
                if (users[index] != undefined) {
                    sql.executeSql(lastseenQ, function (err, data) {
                        if (err) {
                            console.log("Error updating user lastseen to database");
                        } else {
                            // console.log(data);
                            // remove user from the list of connected clients
                        }
                    });
                }
                var i;
                for (i in userStatusReq){
                    if (users[index] == userStatusReq[i]["user"]){
                        var j;
                        for (j in users) {
                            if (users[j] == userStatusReq[i]["requester"]) {
                                clients[j].send(JSON.stringify({type: "userStatus",online:0}));
                            }
                        }
                    }
                }

                userStatusReq = userStatusReq.filter(function (req) {
                    // return req["requester"] != users[index];
                    if (req["user"] == users[index] && req["typing"]) {
                        return true;
                    } else {
                        return req["requester"] != users[index];
                    }
                });
                clients.splice(index, 1);
                users.splice(index, 1);

                // delete clients[index];
                // delete users[index];
            });

        });
    }
};