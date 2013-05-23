var mongoose = require("mongoose"),
	findOrCreate = require('mongoose-findorcreate');

mongoose.connect("mongodb://localhost/trext");
var db = mongoose.connection;
var Schema = mongoose.Schema;
db.on('error',console.error.bind(console,"mongo connection error:"));
db.once("open",function() {
	console.log("mongo database open");
});


var contactSchema = new Schema({
	phone:String,
	runs:[{type:Schema.Types.ObjectId,ref:"Run"}],
	contactGroups:[{type:Schema.Types.ObjectId,ref:"ContactGroup"}],
	nodes:String
});


var contactGroupSchema = new Schema({
	contacts:[{type:Schema.ObjectId,ref:'Contact'}],
	fields:[String],
	name:String,
	treeId:Number
});



var textSchema = new Schema({
	nodeId:Number,
	response:String,
	name:String
});

var conversationSchema = new Schema({
	treeId:Number,
	from:String,
	accountId:Number,
	contactId:{type:Schema.Types.ObjectId,ref:"Contact"},
	currentNodeId:Number,
	conversation:[textSchema]
});

contactSchema.plugin(findOrCreate);

exports.Contact = mongoose.model("Contact",contactSchema);
exports.Conversation = mongoose.model("Conversation",conversationSchema);
exports.Run = mongoose.model("Run",conversationSchema);
exports.ContactGroup = mongoose.model("ContactGroup",contactGroupSchema);
