var SerialPort = require("serialport").SerialPort
  var serialPort = new SerialPort("/dev/ttyUSB2", {});
var pin = 1111;


function gsm(msg) {
	serialPort.write("AT+" + msg + "\r\n",console.log);
}

serialPort.on('open',function(err) {
	try{
	if(err) console.log(err);
	gsm('CPIN="' + pin + '"');
	gsm('CMGF=1');
	gsm('CMGS="+15102955523"');
	gsm('this is a test');
	}catch(e){console.log(e);}

});

