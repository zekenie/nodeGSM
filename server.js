var SerialPort = require("serialport").SerialPort,
	moment = require("moment"),
	express = require("express"),
	app = express(),
	request = require("request"),
	fs = require("fs"),
	_ = require("underscore"),
	serialPort = new SerialPort("/dev/ttyUSB0", {parser:require("serialport").parsers.readline("\n")}),
	pin = 1111,
	postUrl = "127.0.0.1:3000/text,"
	recieved = [];

app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());

app.post("/send",function(req,res){
	console.log("request recieved");
	sendMessage(req.body.number,req.body.message);
	res.send("message sent");
	
});

function sendMessage(number,message){
	gsm('CMGS="+' + number + '"');
	gsm(message + '\u001A',true);
	fs.appendFile("./logs/+" + number + ".txt", "," + JSON.stringify({type:"out",message:message,date:new Date()}),function(err){
		if(err){
			console.log("error writing log file",err);
			return false;
		}
	});
}

function gsm(msg,ignoreAt) {
	var command = "AT+";
	if(ignoreAt) command = "";
	command += msg + "\r\n";
	serialPort.write(command,function(err,resp){
		if(err) {
			console.log("error while running",command,"THE ERROR:",err);
			return;
		}
	});
}

function setup(cb) {
	gsm('CPIN="' + pin + '"');
	gsm('CMGF=1');
	
	if(cb) {
		if(typeof cb === "function")
			cb();
	}
}

function checkForUnread(){
	console.log("---CHECK FOR UNREAD");
	gsm('CMGL="REC UNREAD"');
}

serialPort.on('open',function(err) {
	if(err) {
		console.log("there was an open error",err);
		return;
	}
	console.log("open");
	setup(function(){
		app.listen(8080,function(){
			console.log("webserver running");
			setInterval(checkForUnread,5000);
		});
	});	
});

var expect = false;

serialPort.on('data',function(data) {
	if(data)
		console.log("USB-->",data);
	data = data.replace(/"/g,'');
	if(expect === true) {
		recieved[recieved.length-1].message = data.trim();
		var message= recieved[recieved.length-1];
		request.post({uri:postUrl,json:{from:message.from,message:message.message}},function(err,response,body){
			if(err){
				console.log("error sending text to server",err);
				return false;
			}
			if(true) { //will be some validator of response body
				body = JSON.parse(body);
				sendMessage(message.from,body.Sms);
			}
		});
		fs.appendFile("./logs/" + message.from + ".txt","," + JSON.stringify({type:"in",message:data.trim(),date:message.date}));
		expect = false;
	}
	if(data.indexOf("REC UNREAD") !== -1) {
		var parts = data.split(",");
		recieved.push({date:moment(parts[4] + parts[5].trim().slice(0,-3),"YY/MM/DD,HH:mm:ss"),from:parts[2].trim()});
		expect = true;
	}
});
