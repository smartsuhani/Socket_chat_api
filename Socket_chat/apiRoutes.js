
var multer = require('multer');
var satelize = require('satelize');
var fs = require('fs');
var twilioClient = require('twilio')(
    'AC3b33267f212a5035780b89a5aab9e3be',
    '686f4ccbd6561d7ff7df6153434bd493'
);
var sql = require('./sql');
var user1 = require('./usersGlobal');
var thumb = require('node-thumbnail').thumb;

var contact = new Array();

var number_otp = {};

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        console.log(req.body);
        if (!fs.existsSync('./uploads/user'+parseInt(req.body.senderId))){
            console.log("dir not exist");
            try {
                fs.mkdirSync('./uploads/user'+parseInt(req.body.senderId));
                if (!fs.existsSync('./uploads/user'+parseInt(req.body.senderId)+'/thumbnail')) {
                    try {
                        fs.mkdirSync('./uploads/user'+parseInt(req.body.senderId)+'/thumbnail');
                    } catch (err) {
                        console.log(err);
                    }
                }
            } catch (err) {
                console.log(err);
            }
        }
        req.body.path = "uploads/user"+parseInt(req.body.senderId)+"/";
        req.body.thumbpath = "uploads/user"+parseInt(req.body.senderId)+"/thumbnail/";
        callback(null, 'uploads/user'+parseInt(req.body.senderId)+"/");
    },
    filename: function (req, file, callback) {
        console.log(file);

        var file1 = file.originalname.split(".");
        var date = Date.now();
        req.body.file = file1[0] + "_" + date + "." + file1[file1.length - 1];
        req.body.thumbfile = file1[0] + "_" + date + "_thumb." + file1[file1.length - 1];
        callback(null, req.body.file);
    }
});

var upload = multer({storage:storage});

var video = multer({storage:storage});

module.exports = {
    configure: function (app) {
        app.get('/', function (req, res) {
            res.send("hello");
        });

        app.get('/file',function (req,res) {
            res.sendFile(__dirname+"/form.html");
        });

        app.get('/download',function (req,res) {
            res.sendFile(__dirname+"/"+req.query.url);
        });

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
                                console.log(userobj);
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
                var newuser = "INSERT INTO user (user_id,nick_name,status_user,profileimage,devicetoken,devicetype,lastseen,country,time_zone) VALUES("+num+",'"+num+"','hi there i am on chat app!','./default_pic/default-user.png','','','','','')";
                sql.executeSql(newuser,function (err,data) {
                    if (err) {

                    } else {

                    }
                });
            } else {
                res.send({resp: "failed"});
            }
        });

        app.post('/profilecreation', upload.any(),function (req,res) {
            // upload(req,res,function (err) {
            //     console.log(req);
            //     if (err) {
            //         console.log("failed :" + err);
            //         res.send({resp: "failed"});
            //     } else {
            //         console.log(req);
            thumb({
                source: req.body.path+req.body.file, // could be a filename: dest/path/image.jpg
                destination: req.body.path+"thumbnail",
                concurrency: 4
            },function (err,stdout,stderr) {
               if (err) {

               } else {
                   var ip = req.headers["x-real-ip"];
                   var country;
                   var timezone;
                   satelize.satelize({ip: ip}, function (err, payload) {
                       if (err) {

                       } else {
                           country = payload.country.en;
                           timezone = payload.timezone;

                           var lastseen = (new Date()).getTime();
                           var updateuser = "UPDATE user set nick_name = '" + req.body.username + "' ,profileimage = '" + req.body.path + req.body.file + "' ,lastseen = " + lastseen + " ,country = '" + country + "' ,time_zone = '" + timezone + "' WHERE user_id = " + parseInt(req.body.senderId);
                           sql.executeSql(updateuser, function (err, data) {
                               if (err) {
                                   console.log("user " + req.body.senderId + " " + req.body.username + " updation failed");
                                   res.send({resp: "failed"});
                               } else {
                                   console.log("user " + req.body.senderId + " updated successfully");
                                   res.send({resp: "success"});
                               }
                           });
                       }
                   });
               }
            });
            //     }
            // });
        });

        app.post('/uploads',upload.any(), function (req, res) {

            console.log(req.body);
            thumb({
                source: req.body.path+req.body.file, // could be a filename: dest/path/image.jpg
                destination: req.body.path+"thumbnail",
                concurrency: 4
            }, function(err, stdout, stderr) {
                if(err){
                    console.log(err);
                }else{
                    console.log("success");
                    for (var u in user1.users) {
                        if (req.body.receiver_id == user1.users[u]) {
                            user1.clients[u].send(JSON.stringify({
                                senderId:req.body.senderId,
                                imageUrl: "/download?url="+req.body.path+req.body.file,
                                imageThumbnail: "/download?url="+req.body.path+req.body.thumbfile,
                                time: (new Date()).getTime(),
                                type: 'imageMessage'
                            }));
                        }
                    }
                    res.send({downloadUrl: "/download?url="+req.body.path+req.body.file});
                }
            });

        });

        app.post('/uploads/video',video.any(), function (req, res) {

            console.log(req.body);
            thumb({
                source: req.body.path+req.body.file, // could be a filename: dest/path/image.jpg
                destination: req.body.path+"thumbnail",
                concurrency: 4
            }, function(err, stdout, stderr) {
                if(err){
                    console.log(err);
                }else{
                    console.log("success");
                    for (var u in user1.users) {
                        if (req.body.receiver_id == user1.users[u]) {
                            user1.clients[u].send(JSON.stringify({
                                senderId:req.body.senderId,
                                imageUrl: "/download?url="+req.body.path+req.body.file,
                                imageThumbnail: "/download?url="+req.body.path+req.body.thumbfile,
                                time: (new Date()).getTime(),
                                type: 'videoMessage'
                            }));
                        }
                    }
                    res.send({downloadUrl: "/download?url="+req.body.path+req.body.file});
                }
            });

        });

        app.post('/contactCheck',function (req,res) {
            var userNo = req.body.users;
            var userCheckQuery = '';
            userNo.forEach(function(number) {
                userCheckQuery += "SELECT * FROM user WHERE user_id = "+parseInt(number) + "; ";
            });
            sql.executeSql(userCheckQuery,function (err,data) {
                if (err) {

                } else {
                    data.forEach(function (num) {
                        if (num.length > 0) {
                            contact.push({
                                number: num[0].user_id,
                                profile_pic: "/download?url="+(num[0].profileimage).toString(),
                                nick_name: num[0].nick_name,
                                status_user: num[0].status_user,
                                lastseen: num[0].lastseen,
                                country: num[0].country,
                                time_zone: num[0].time_zone,
                                profile_thumb: "/download?url="+(num[0].profile_thumb).toString()
                            });
                        } else {
                        }
                    });
                    if (contact.length > 0) {
                        res.send(contact);
                    } else {
                        res.send({resp: "success with no contact"});
                    }
                    contact.splice(0, contact.length);
                }
            });
        });
    }
};