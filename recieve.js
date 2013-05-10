var SerialPort = require("serialport").SerialPort
  var serialPort = new SerialPort("/dev/ttyUSB0", {parser:require("serialport").parsers.readline("\n")});
var pin = 1111;


function gsm(msg,ignoreAt) {
	var command = "AT+";
	if(ignoreAt) command = "";
	command += msg + "\r\n";
	console.log(command);
	serialPort.write(command,function(err,resp){
		if(err) {
			console.log("error while running",command,"THE ERROR:",err);
			return;
		}
		console.log(resp);
	});
}

serialPort.on('open',function(err) {
	gsm('CPIN="' + pin + '"');
	gsm("CMGF=1");
	//gsm('CPMS="SM"');
	gsm('CMGL="REC UNREAD"');
});

serialPort.on('data',function(data) {
	console.log("data recieved",data);
});
