const express = require("express");
const app = express();

// Add Middleware
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const logger = require("../mbmcauliffe-web-core/utilities/src/logger");
const mongoSanitize = require('express-mongo-sanitize');

// Auth Modules
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Server Configuration
const selfPort = 3000;
const tokenSecret = crypto.randomBytes(128).toString("HEX");

//////////////////////////////// Rate Limiter ////////////////////////////////

// Require rate limiter
const rateLimit = require('express-rate-limit')

// Limit total requests
const limiter = rateLimit({
	handler: (req, res, next) => {return res.status(429).render("429.ejs");},
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window`
	standardHeaders: false,
	legacyHeaders: false
});

// Limit login requests
const loginLimiter = rateLimit({
	handler: (req, res, next) => {return res.status(429).render("429.ejs");},
	windowMs: 1 * 60 * 1000,
	max: 100,
	standardHeaders: false,
	legacyHeaders: false
});

//////////////////////////////// MongoDB ////////////////////////////////

const mongoose = require("mongoose");

// Import Data Models
const User = require("./models/User");
const Task = require("./models/Task");

// Open and Log MongoDB Connection
mongoose.connect("mongodb://localhost/task-application");
const db = mogoose.connection;
db.on("error", (error)=>{ console.log("\n!!!!! Mongoose Error !!!!!\n\n" + error + "\n\n"); });
db.once("open", ()=>{ console.log("Connected to MongoDB"); });


//////////////////////////////// Server Functions ////////////////////////////////

function convertToken(req, res, next){

	// convert auth cookie to a plain token form
	if( req.cookies.authorization ){
		req.headers.authorization = req.cookies.authorization.split("Bearer ")[1];

	// convert auth header to a plain token form
	} else if ( req.headers.authorization ) {
		req.headers.authorization = req.headers.authorization.split("Bearer ")[1];
	}

	next();

}

async function authorizeToken( req, res, next ){
	// Compare tokens passed by requests to the auth database

	// Reject if the token does not exist
	if ( req.headers.authorization == null ) {
		return res.stratus("401.ejs").redirect("/login");
	}

	jwt.verify(req.headers.authorization, tokenSecret, async (err, tokenData) => {

		// Reject if the token is invalid
		if(err){
			return res.stratus("401.ejs").redirect("/login");
		}

		// Check the database for the user's email address
		const existingUser = Users.findOne({ email: tokenData.email });

		// Reject if the user is not currently in the database
		if ( existingUser == null ) {
			return res.stratus("403.ejs").redirect("/login");
		}

		// Create a token to be sent back to the user browser
		const userToken = jwt.sign({ email: email }, tokenSecret, {expiresIn: '604800s'});

		// Send the user's token as both and authorization header and as a cookie
		res.set("Access-Control-Expose-Headers", "authorization");
		res.set("authorization", "Bearer " + userToken);
		res.cookie('authorization', "Bearer " + userToken, { httpOnly:true, /*dev secure:true,*/ maxAge:604800000 /* Miliseconds */ });

		next();

	});

}

//////////////////////////////// Middleware ////////////////////////////////

// Static Resource Configuration
app.set('view-engine', 'ejs');
app.set('views', '../mbmcauliffe-presentation/views/www');

// Request Processing
app.use(bodyParser.json());
app.use(cookieParser());
app.use(logger);
app.use(convertToken);

// Application Security
app.disable('x-powered-by');
app.use(mongoSanitize());
app.use(limiter);

//////////////////////////////// Express Routes ////////////////////////////////

app.post('/login', async (req, res) => {

	// Prevent logged-in users from using this route
	if ( req.headers.authorization ) {
		return res.redirect("/");
	}

	// Send an Error to the Front-End if the email address is empty
	if ( req.body.email === "" ) {

		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: 'The "Email" field cannot be empty.'
		}));

	}

	// Check the database for the user's email address
	const existingUser = await Users.findOne({"email": req.body.email.toLowerCase()});

	// Send an Error to the Front-End if the user is not found in the database
	if(existingUser == null){
		return res.status(400).send(JSON.stringify({
			title: "Incorrect Login Credentials",
			message: "Please try again."
		}));
	}

	// Compare the hash of the request's password to the stored hash of the user's password
	const compare = await bcrypt.compare(req.body.password, existingUser.password);

	// Send an Error to the Front-End if the user's password is incorrect
	if(!compare){
		return res.status(400).send(JSON.stringify({
			title: "Incorrect Login Credentials",
			message: "Please try again."
		}));
	}

	// Create a token to be sent back to the user browser
	const userToken = jwt.sign({ email: email }, tokenSecret, {expiresIn: '604800s'});

	// Send the user's token as both and authorization header and as a cookie
	res.set("Access-Control-Expose-Headers", "authorization");
	res.set("authorization", "Bearer " + userToken);
	res.cookie('authorization', "Bearer " + userToken, { httpOnly:true, /*dev secure:true,*/ maxAge:604800000 /* Miliseconds */ });
	
	// Trigger the Front-End to redirect to its destination
	res.status(200).send();

});

app.post('/create', async (req, res) => {

	// Prevent logged-in users from using this route
	if (req.headers.authorize.split(" ")[1] != null) {
		return res.redirect("/");
	}

	// Check the database for the user's email address
	const existingUser = await Users.findOne({"email": req.body.email.toLowerCase()});

	// Send an Error to the Front-End if the email address is already in the database
	if(existingUser != null){
		return res.status(400).send(JSON.stringify({
			title: "Invalid User Creation",
			message: "See your application administrator to correct this error."
		}));
	}

	// Create a new user instance
	const user = new Users();

	// Set the initial user information values
	user.firstName = req.body.firstName;
	user.lastName = req.body.lastName;
	user.email = req.body.email.toLowerCase();
	user.password = await bcrypt.hash(req.body.password, 8);
	user.sharePartners = [];

	// Save the new user
	user.save();

	// Trigger the Front-End to redirect to its destination
	return res.status(200).send();

});

app.use(authorizeToken);

app.delete('/logout', async (req, res) => {

	// Set the Authorization Header to a useless value
	res.set("Access-Control-Expose-Headers", "authorization");
	res.set("authorization", "Bearer " + "Logged-Out");

	// Invalidate the user's authorization cookie
	res.clearCookie('authorization', { httpOnly:true, /*dev secure:true,*/ maxAge:604800000 /* Miliseconds */ });

	// Trigger the Front-End to redirect to its destination
	res.status(200).send();

});

//////////////////////////////// Server Initialization ////////////////////////////////

app.listen(selfPort, ()=> console.log('Tasks-Application running at ' + selfPort));