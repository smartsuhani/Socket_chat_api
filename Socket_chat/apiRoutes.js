
var multer = require('multer');
var satelize = require('satelize');
var fs = require('fs');
var twilioClient = require('twilio')(
    'AC3b33267f212a5035780b89a5aab9e3be',
    '686f4ccbd6561d7ff7df6153434bd493'
);
var sql = require('./sql');

var number_otp = {};

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        console.log(req.body);
        if (!fs.existsSync('./uploads/user'+parseInt(req.body.senderId))){
            console.log("dir not exist");
            try {
                fs.mkdirSync('./uploads/user'+parseInt(req.body.senderId));
            } catch (err) {
                console.log(err);
            }
        }
        req.body.path = "./uploads/user"+parseInt(req.body.senderId)+"/";
        callback(null, './uploads/user'+parseInt(req.body.senderId)+"/");
    },
    filename: function (req, file, callback) {
        console.log(file);

        var file1 = file.originalname.split(".");
        req.body.file = file1[0] + "_" + Date.now() + "." + file1[file1.length - 1];
        callback(null, req.body.file);
    }
});

var upload = multer({storage:storage});

module.exports = {
    configure: function (app) {
        app.get('/', function (req, res) {
            // res.sendFile(__dirname+"/form.html");
            res.send("hello");
        });

        app.get('/download',function (req,res) {
            res.sendFile(__dirname+"/"+req.query.file);
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
            //     }
            // });
        });

        app.post('/uploads', function (req, res) {
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
    }
};