var Seq = require("sequelize"),
	con = new Seq("trext","root","2267alexandre#",{host:"127.0.0.1",pool:{maxConnections:5,maxIdleTime:30}});
	
exports.query = con.query;
exports.con = con;

//TABLES

exports.Node = con.define("node",{
	name:Seq.STRING,
	text:Seq.STRING,
	x:Seq.INTEGER,
	y:Seq.INTEGER,
	startingPoint:Seq.BOOLEAN,
	numConnections:Seq.INTEGER,
});

exports.Connection = con.define("connection",{
	//from:Seq.INTEGER,
	//to:Seq.INTEGER,
	case:Seq.STRING,
	comparator:Seq.STRING,
});

exports.Tree = con.define("tree",{
	name:Seq.STRING,
	numRuns:Seq.INTEGER,
});

exports.User = con.define("user", {
	// no need for id
	email:Seq.STRING
});

exports.Account = con.define("account",{
	// don't need to define id
	name:Seq.STRING
});

//ASSOC
exports.Account.hasOne(exports.User);

exports.Connection.hasOne(exports.Node,{as:"from",foreignKey:"id"});

exports.Node.hasMany(exports.Connection,{as:"connectionsFrom",foreignKey:"from"});
exports.Node.hasMany(exports.Connection,{as:"connectionsTo",foreignKey:"to"});

exports.Tree.hasMany(exports.Node,{as:"nodes"});
exports.Tree.hasMany(exports.Connection,{as:"connections"});


