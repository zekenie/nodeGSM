var SerialPort = require("serialport").SerialPort,
	moment = require("moment"),
	express = require("express"),
	app = express(),
	fs = require("fs"),
	//forever = require("forever-monitor"),
	_ = require("underscore"),
	serialPort = new SerialPort("/dev/ttyUSB1", {/*parser:require("serialport").parsers.readline("\n")*/}),
	pin = 0000,
	mysql = require("./lib/mysql"),
	mongo = require("./lib/mongo"),
	postUrl = "http://127.0.0.1,"
	recieved = [],
	outgoing = [];

app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());

//var webapp = new (forever.Monitor)("/home/user/trext/server.js",{max:10});
//webapp.start();	


//TO BE REMOVED AFTER TESTING PERIOD
app.post("/send",function(req,res){
	console.log("request recieved");
	sendMessage(req.body.number,req.body.message);
	res.send("message sent");
});

app.get("/contactGroup",function(req,res) {
	res.set("Access-Control-Allow-Origin","*");
	mongo.ContactGroup.findById(req.query.id).populate("contacts").exec(function(err,contactGroup) {
		if(err) {
			console.log("error finding contact group",err);
			res.send(500);
			return;
		}
		console.log(contactGroup,"CONTACTGROUP"	);
		mysql.Tree.find(contactGroup.treeId).error(console.log).success(function(tree) {
			mysql.Node.find({where:{treeId:tree.id,startingPoint:1}}).error(console.log).success(function(node){
				res.send(200);
				console.log("CONTACTS",contactGroup.contacts);
				contactGroup.contacts.forEach(function(contact){
					console.log("finding contact");
					mongo.Conversation.findOne({from:contact.phone},function(err,conversation){
						if(conversation){
							console.log("found old conv",conversation);
							conversation.remove(function(err){
								if(err){console.log("cant't remove old conv");}
								else{console.log("old conversation deleted");}
							});
						}
							mongo.Conversation.create({
								treeId:tree.id,
								from:contact.phone,
								contactGroupId:contactGroup._id,
								contactId:contact.id,
								currentNodeId:node.id,
								conversation:[{nodeId:node.id,response:"",name:node.name}]
							},function(err,conversation) {
								if(err) {
									console.log("error saving contact",err);
									return;
								}
								sendMessage(contact.phone,node.text);
							});
							
					})
					
				});
			});
		});
	});
});

function sendMessage(number,message){
	outgoing.push({number:number,message:message})
}

function gsmSend() {
	if(outgoing.length > 0){
		toSend = outgoing.pop();
		console.log("*****************Sending to",toSend.number,"mesage:",toSend.message,new Date(),"****************");
		gsm('CMGS="' + toSend.number + '"');
		gsm(toSend.message + '\u001A',true);
		fs.appendFile("./logs/+" + toSend.number + ".txt", "," + JSON.stringify({type:"out",message:toSend.message,date:new Date()}),function(err){
			if(err){
				console.log("error writing log file",err);
				return false;
			}
		});
	}
	
	setTimeout(gsmSend,2690);
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
	//gsm('CMGL="ALL"');
	gsm('CMGD=0,1'); //this is for deleting messages when the inbox is full!!!
}

serialPort.on('open',function(err) {
	if(err) {
		console.log("there was an open error",err);
		return;
	}
	console.log("open");
	setup(function(){
		app.listen(8000,'127.0.0.1',function(){
			console.log("webserver running");
			gsmSend();
			//setInterval(checkForUnread,6000);
		});
	});	
});

var expect = false;




serialPort.on('data',function(data) {
	data = data.toString();
	var lines = _.compact(data.replace("\r","").split("\n"));
	console.log(lines);
	
	//find out of line 0 contains "REC UNREAD", indicating that we have recieved a text
	_.each(lines,function(line,i) {
		if(line.indexOf("REC UNREAD") !== -1) { //the line says there is an incoming text
			line = line.replace(/"/g,'');
			var parts = line.split(",");
			var message = {
				date:moment(parts[4] + parts[5].trim().slice(0,-3),"YY/MM/DD,HH:mm:ss"),
				from:parts[2].trim(),
				message:lines[i+1].trim()
			};
			route({from:message.from,body:message.message});
			fs.appendFile("./logs/" + message.from + ".txt","," + JSON.stringify({type:"in",message:data.trim(),date:message.date}));
			recieved.push(message);
		}
		if(line.indexOf('+CMTI: "ME"') !== -1) {
			checkForUnread();
		}
	//	if(line.indexOf('+CMGS') !== -1) {
	//		gsmSend();
	//	}
	});
});





/////////////////////other file




function route(text) {
	
	//check if there is already a conversation with that number open
	if(text.from.length > 6) {
		mongo.Conversation.findOne({from:text.from},function(err,conversation) {
			if(err) {
				console.log("there was an error finding conversations",err);
				return;
			}
			console.log("the conversation is",conversation);
			if(conversation) {/* there is a conversation open */
				if(text.body === "!"){
					sendMessage(text.from,"Se fini");
					finish(conversation);
				}else
					continueConversation(text,conversation);
			} else {
				startConversation(text);
			}
		});
	}
	gsm('CMGD=0,1');
}
function continueConversation(text,conversation) {
	mysql.Connection.findAll({where:{from:conversation.currentNodeId}}).error(console.log).success(function(connections) {
		var nextNodeID = _.find(connections,function(connection) {
			var body = text.body.trim().toLowerCase();
			var test =	(connection.comparator === '='			&& connection['case'] === text.body.toLowerCase())
					||	(connection.comparator === 'contains'	&& text.body.toLowerCase().indexOf(connection['case'].toLowerCase()) !== -1)
					||	(connection.comparator === ">"			&& parseInt(text.body) > connection['case'])
					||	(connection.comparator === "<"			&& parseInt(text.body) < connection['case'])
					||	 connection.comparator === "any case";
			return test;
		});
		if(!nextNodeID) { //there's no next node
			var txt = "Sorry, didn't understand that, you can reply with ";
			var thingsToReply = [];
			var comparators = _.pluck(connections,"comparator");
			if(_.contains(comparators,"<") || _.contains(comparators,"<"))
				thingsToReply.push("any number");
			_.chain(connections)
				.filter(function(connection) { return connection.comparator === "=" || connection.comparator === "contains";})
				.each(function(connection) { thingsToReply.push(connection['case']); });

			_.each(thingsToReply,function(thing,i) {
				if( i !== 0 )
					txt += ", ";
				if(thingsToReply.length > 1 && i === thingsToReply.length-1 )
					txt += "or ";
				txt += "'" + thing + "'";
			});
			sendMessage(text.from,txt + ".");
		} else { // there is a next node
			console.log("**the next node should be",nextNodeID.selectedValues);
			nextNodeID = nextNodeID.to;
			mysql.Node.find(nextNodeID).error(console.log).success(function(node) {
				mysql.Node.find(nextNodeID).error(console.log).success(function(node) {
					sendMessage(text.from,node.text);	
				});
				
				conversation.conversation[conversation.conversation.length-1].response = text.body;
				conversation.conversation.push({nodeId:nextNodeID,name:node.name,response:''});
				conversation.currentNodeId = nextNodeID;
				conversation.save(function(err,conversation) {
					if(err) {
						console.log('error saving conversation',err);
						return;
					}
					console.log("the conversation was saved",conversation);
					if(node.numConnections === 0) {
						finish(conversation);
					}
				});
			});
			
		}
	});
}

function finish(conversation) {	//takes the conversation out of conversation and puts it into run for archieve
	console.log("FINISHING CONVERSATION");
	mongo.Run.create(_.omit(conversation.toObject(),"_id"),function(err,run) {
		if(!err) {
			mongo.Contact.findOne(run.contactId,function(err,contact){
				contact.runs.push(run._id);
				contact.save();
			});
			conversation.remove(function(err) {
				if(err) {
					console.log("error removing conversation");
					return;
				}
				console.log("REMOVED CONVERSATION");
			});
		}else{
			console.log('error creating run',err);
			return;
		}
	});
}

function startConversation(text) {
	//find tree
	mysql.Tree.find({where:{name:text.body}}).error(console.log).success(function(tree){
		if(_.isEmpty(tree)) {
			sendMessage(text.from,"Se pa youn nan chwa"); //not one of the choices
		} else {
			//find starting node
			mysql.Node.find({where:{startingPoint:1,treeId:tree.id}}).error(console.log).success(function(node){
				sendMessage(text.from,node.text);
				mongo.Contact.findOrCreate({phone:text.from},function(err,contact,created) {
					if(err) {
						console.log("error finding or create contact",err);
						return;
					}
					console.log("contact interaction:",created," id:",contact._id);
					mongo.Conversation.create({
						treeId:tree.id,
						currentNodeId:node.id,
						contactId:contact._id,
						from:text.from,
						conversation:[{
							nodeId:node.id,
							response:"",
							name:node.name
						}]
					},function(err,conversation) {
						if(err) {
							console.log("error creating conversation");
							return;
						}
						console.log("conversation created",conversation);
					});
				});
			});
			
		}
	});
}

