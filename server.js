var SerialPort = require("serialport").SerialPort,
	moment = require("moment"),
	express = require("express"),
	app = express(),
	fs = require("fs"),
	_ = require("underscore"),
	serialPort = new SerialPort("/dev/ttyUSB0", {parser:require("serialport").parsers.readline("\n")}),
	pin = 1111,
	recieved = [];

app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());

app.post("/send",function(req,res){
	console.log("request recieved");
	gsm('CMGS="+' + req.body.number + '"');
	gsm(req.body.message + '\u001A',true);
	res.send("message sent");
	fs.appendFile("./logs/+" + req.body.number + ".txt", "," + JSON.stringify({type:"out",message:req.body.message,date:new Date()}),console.log);
});

app.get("/recieved",function(req,res) {
	res.json(recieved);
});

function gsm(msg,ignoreAt) {
	var command = "AT+";
	if(ignoreAt) command = "";
	command += msg + "\r\n";
	//console.log(command);
	serialPort.write(command,function(err,resp){
		if(err) {
			console.log("error while running",command,"THE ERROR:",err);
			return;
		}
		//console.log(resp);
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
	//gsm('CPIN="' + pin + '"');
	//gsm("CMGF=1");
	//gsm('CPMS="SM"');
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
	//detect incoming message
	data = data.replace(/"/g,'');
	if(expect === true) {
		recieved[recieved.length-1].message = data.trim();
		fs.appendFile("./logs/" + recieved[recieved.length-1].from + ".txt","," + JSON.stringify({type:"in",message:data.trim(),date:recieved[recieved.length-1].date}));
		expect = false;
	}
	if(data.indexOf("REC UNREAD") !== -1) {
		var parts = data.split(",");
		recieved.push({date:moment(parts[4] + parts[5].trim().slice(0,-3),"YY/MM/DD,HH:mm:ss"),from:parts[2].trim()});
		expect = true;
	}
});
