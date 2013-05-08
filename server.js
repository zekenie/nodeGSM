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
	if(err) {
		console.log("there was an open error",err);
		return;
	}
	console.log("open");
	try{
	if(err) console.log(err);
	//gsm('CPIN="' + pin + '"');
	//gsm('CMGF=1');
	//gsm('CMGS="+15102955523"');
	gsm('this is a test \u001A',true);
	}catch(e){console.log(e);}

});


serialPort.on('data',function(data) {
	console.log("data recieved",data);
});
