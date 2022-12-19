/*

Copyright 2022 Michael B McAuliffe

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that
the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING
ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL,
DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR
PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION
WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

*/

const express = require("express");
const app = express();
const fs = require("fs");

// Add Middleware
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const logger = require("./node_modules/mbmcauliffe-utilities/src/logger");
const mailjet = require("./node_modules/mbmcauliffe-utilities/src/mailjet");
const mongoSanitize = require('express-mongo-sanitize');
const compression = require("compression");
const helmet = require("helmet");
const https = require("https");

// Auth Modules
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Server Configuration
require('dotenv').config();
const devPort = 3000;
const serverMode = process.env.SERVER_MODE;
const websiteUrl = process.env.WEBSITE_URL;
const mailjetApiKey= process.env.MAILJET_API_KEY;
const mailjetSecretKey= process.env.MAILJET_SECRET_KEY;
const noReplyAddress = process.env.NO_REPLY_ADDRESS;
const maintainerEmail = process.env.MAINTAINER_EMAIL;
var tokenSecret;
var cookieOptions;
if ( serverMode === "dev" ) {
	tokenSecret = "dev";
	cookieOptions = { httpOnly:true, sameSite: "Strict", secure:true, maxAge:604800000 /* Miliseconds */ }
} else {
	tokenSecret = crypto.randomBytes(128).toString("HEX");
	cookieOptions = { httpOnly:true, sameSite: "Strict", secure:false, maxAge:604800000 /* Miliseconds */ }
}


//////////////////////////////// Rate Limiter ////////////////////////////////

// Require rate limiter
const rateLimit = require('express-rate-limit')

// Limit total requests
const limiter = rateLimit({
	handler: (req, res, next) => {
		return res.status(429).render("429.ejs");
	},
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window`
	standardHeaders: false,
	legacyHeaders: false
});

// Limit login requests
const loginLimiter = rateLimit({
	handler: (req, res, next) => {
		return res.status(429).render("429.ejs");
	},
	windowMs: 1 * 60 * 1000,
	max: 100,
	standardHeaders: false,
	legacyHeaders: false
});

//////////////////////////////// MongoDB ////////////////////////////////

const mongoose = require("mongoose");
mongoose.set('strictQuery', true);

// Import Data Models
const User = require("./models/User");
const Task = require("./models/Task");

// Open and Log MongoDB Connection
mongoose.connect("mongodb://localhost/taskApplication");
const db = mongoose.connection;
db.on("error", (error)=>{ console.log("\n!!!!! Mongoose Error !!!!!\n\n" + error + "\n\n!!!!! Mongoose Error !!!!!\n"); });
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

	req.headers.user = null;

	// Reject if the token does not exist
	if ( req.headers.authorization == null ) {
		return res.status(401).redirect("/");
	}

	jwt.verify(req.headers.authorization, tokenSecret, async (err, tokenData) => {

		// Reject if the token is invalid
		if(err){

			// Set the Authorization Header to a useless value
			res.set("Access-Control-Expose-Headers", "authorization");
			res.set("authorization", "Bearer " + "Rejected Token");

			// Invalidate the user's authorization cookie
			res.clearCookie('authorization', cookieOptions);

			return res.status(401).send();

		}

		// Check the database for the user's email address
		const existingUser = await User.findOne({ email: tokenData.email });

		// Reject if the user is not currently in the database
		if ( existingUser == null ) {
			return res.status(403).redirect("/");
		}

	if ( existingUser.isVerified !== true && req.url !== "/verify" && req.url !== "/logout" ){
		return res.status( 403 ).render( "verifyEmail.ejs" );
	}

		// Attach the user's information to be used later in the application
		req.headers.user = {
			id: await existingUser._id,
			email: await existingUser.email,
			firstName: await existingUser.firstName,
			lastName: await existingUser.lastName,
			people: await existingUser.people,
			isVerified: await existingUser.isVerified
		};

	if ( existingUser.isVerified === true && req.url === "/verify" ){
		return res.redirect('/');
	}

		// Create a token to be sent back to the user browser
		const userToken = jwt.sign({ email: existingUser.email }, tokenSecret, {expiresIn: '604800s'});

		// Send the user's token as both and authorization header and as a cookie
		res.set("Access-Control-Expose-Headers", "authorization");
		res.set("authorization", "Bearer " + userToken);
		res.cookie('authorization', "Bearer " + userToken, cookieOptions);

		next();

	});

}

function validateEmail( req, res, next ){

	const email = req.body.email;
	var reject = false;

	if(email == ""){
		res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: 'Please use a valid email address.'
		}));
	}

	if(email.split(" ") != email){
		reject = true;
	}

	if(email.split("@") == email){
		reject = true;
	}

	if(email.split("@")[1].split(".") == email.split("@")[1]){
		reject = true;
	}

	if(email.split("@")[1].split(".").length != 2){
		reject = true;
	}

	if(email.split("@")[1].split(".")[1] == ""){
		reject = true;
	}

	if ( reject === true ) {
		res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: 'Please use a valid email address.'
		}));
	}

	next();

}

function redirectHTTP(req, res, next){

	if ( req.hostname !== websiteUrl ) {
		return res.sendStatus(401);
	}

  if (!req.secure) {

    return res.redirect("https://" + websiteUrl);

  }

  next();

}

async function sendMail( recipient, subject, htmlBody ) {
	
	mailjet( mailjetApiKey, mailjetSecretKey, noReplyAddress, websiteUrl, recipient, subject, htmlBody );

}

//////////////////////////////// Middleware ////////////////////////////////

// Reference Configuration
app.set('view-engine', 'ejs');
app.set('views', './views');
app.use(express.static('./public'));

// Request Processing
app.use(bodyParser.json());
app.use(cookieParser());
app.use(convertToken);

// Application Security
app.disable('x-powered-by');
app.use(mongoSanitize());
app.use(limiter);

if (serverMode !== "dev") {
	app.use(redirectHTTP);
	app.use(compression());
	app.use(helmet({
		contentSecurityPolicy: false,
	}));
}

app.use(logger);

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
	const existingUser = await User.findOne({"email": req.body.email.toLowerCase()});

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
	const userToken = jwt.sign({ email: existingUser.email }, tokenSecret, {expiresIn: '604800s'});

	// Send the user's token as both and authorization header and as a cookie
	res.set("Access-Control-Expose-Headers", "authorization");
	res.set("authorization", "Bearer " + userToken);
	res.cookie('authorization', "Bearer " + userToken, cookieOptions);
	
	// Trigger the Front-End to redirect to its destination
	res.status(200).send();

});

app.get('/create', async (req, res) => {

	// Prevent logged-in users from using this route
	if ( req.headers.authorization ) {
		return res.redirect("/");
	}

	return res.render("createUser.ejs");

});

app.post('/create', validateEmail, async (req, res) => {

	// Prevent logged-in users from using this route
	if ( req.headers.authorization ) {
		return res.redirect("/");
	}

	// Check the database for the user's email address
	const existingUser = await User.findOne({"email": req.body.email.toLowerCase()});

	// Send an Error to the Front-End if the email address is already in the database
	if(existingUser != null){
		return res.status(400).send(JSON.stringify({
			title: "Email In Use",
			message: "There is already an account using this email address."
		}));
	}

	if( req.body.firstName == "" ){
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "Your First Name is Required."
		}));
	}

	if( req.body.lastName == "" ){
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "Your Last Name is Required."
		}));
	}

	if( req.body.password == "" ){
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "A Password is Required."
		}));
	}

	// Create a new user instance
	const user = new User();

	// Set the initial user information values
	user._id = crypto.randomBytes(16).toString("HEX");
	user.firstName = req.body.firstName;
	user.lastName = req.body.lastName;
	user.email = req.body.email.toLowerCase();
	user.password = await bcrypt.hash(req.body.password, 8);

	// Save the new user
	user.save();

	// Create a token to be sent back to the user browser
		const userToken = jwt.sign({ email: user.email }, tokenSecret, {expiresIn: '604800s'});

		// Send the user's token as both and authorization header and as a cookie
		res.set("Access-Control-Expose-Headers", "authorization");
		res.set("authorization", "Bearer " + userToken);
		res.cookie('authorization', "Bearer " + userToken, cookieOptions);

	// Trigger the Front-End to redirect to its destination
	return res.status(200).send();

});

app.get('/', async (req, res, next) => {

	// Prevent logged-in users from using this route
	if ( req.headers.authorization ) {
		next();
		return
	}

	return res.render("homepage.ejs");

});

app.get("/verify/:identifier", async ( req, res )=>{
	// Check the url-based single-use identifier, render a different page depending on the success of the check

	const date = new Date();
	const timeNow = date.getTime();

	for ( i=0; i<verifyTokens.length; i++ ) {

		if ( verifyTokens[i].created + 259200000 < timeNow ) {
			verifyTokens.splice( i, 1 );
			continue
		}

		if ( req.params.identifier === verifyTokens[i].token ) {

			const user = await User.findOne({ _id: verifyTokens[i].user });
			user.isVerified = true;
			user.save();

			verifyTokens.splice( i, 1 );

			return res.render( "emailVerified.ejs" );
			
		}

	}

	return res.render( "verifyEmail.ejs" );

});

app.get("/reset/:identifier", ( req, res )=>{

	return res.render("resetPassword.ejs");

});

app.post("/reset/:identifier", async ( req, res )=>{

	const user = await User.findOne({ email: req.body.email });

	if( user == null ){
		return res.sendStatus(200);
	}

	if ( req.params.identifier !== user.identifier ) {
		return res.sendStatus(200);
	}

	user.password = await bcrypt.hash(req.body.password, 8);
	user.identifier = null;

	user.save();

	return res.sendStatus(200);

});

app.get("/reset", ( req, res )=>{

	return res.render("forgotPassword.ejs");

});

app.post("/reset", async ( req, res )=>{
	// Send the user an email redirecting them to a GET route with their unique identifier

	const user = await User.findOne({ email: req.body.email });
	if( user == null ){
		return res.sendStatus(200);
	}

	const identifier = crypto.randomBytes(16).toString("HEX");

	user.identifier = identifier;
	user.save();

	identifierURL = "https://" + websiteUrl + "/reset/" + identifier;
	const htmlBody = "<style type='text/css'>*{ font-size: 20px; } .button{ font-weight:bold; text-decoration: none;	display: block;background: hsl(205, 100%, 16%);width: max-content;height: 1em;padding: 0.2em 0.5em 0.2em 0.5em;margin: 0.25em 1em 0.25em 0em;color: white;line-height: 1em;cursor: pointer;border:0.1em solid white } .button:hover{ color: hsl(205, 100%, 16%); background-color: white; border-color: hsl(205, 100%, 16%); }</style>Howdy,<br><br>Please use the following link to reset your password with Tasks:<br><br><a clicktracking='off' href=" + identifierURL + " target='_blank' class='button' >Reset Password</a><br>Thank you,<br>Tasks.MBMcAuliffe.net";

	sendMail( req.body.email, "Password Reset: " + websiteUrl, htmlBody );

	return res.sendStatus(200)

});

app.use(authorizeToken);

var verifyTokens = [];

app.post("/verify", async ( req, res )=>{
	// Send the user an email redirecting them to a GET route with their unique identifier

	const identifier = crypto.randomBytes(16).toString("HEX");

	const date = new Date();

	verifyTokens.push({
		token: identifier,
		user: req.headers.user.id,
		created: date.getTime()
	});

	identifierURL = "https://" + websiteUrl + "/verify/" + identifier;
	const htmlBody = "<style type='text/css'>*{ font-size: 20px; } .button{ font-weight:bold; text-decoration: none;	display: block;background: hsl(205, 100%, 16%);width: max-content;height: 1em;padding: 0.2em 0.5em 0.2em 0.5em;margin: 0.25em 1em 0.25em 0em;color: white;line-height: 1em;cursor: pointer;border:0.1em solid white } .button:hover{ color: hsl(205, 100%, 16%); background-color: white; border-color: hsl(205, 100%, 16%); }</style>Howdy,<br><br>Please use the following link to verify your email address with Tasks:<br><br><a clicktracking='off' href=" + identifierURL + " target='_blank' class='button' >Verify Email</a><br>Thank you,<br>Tasks.MBMcAuliffe.net";

	sendMail( req.headers.user.email, "Verify your email with " + websiteUrl, htmlBody );

	return res.sendStatus(200)

});

app.delete('/logout', async (req, res) => {

	// Set the Authorization Header to a useless value
	res.set("Access-Control-Expose-Headers", "authorization");
	res.set("authorization", "Bearer " + "Logged-Out");

	// Invalidate the user's authorization cookie
	res.clearCookie('authorization', cookieOptions);

	// Trigger the Front-End to redirect to its destination
	res.status(200).send();

});

app.use("/people", require("./routes/people"));
app.use("/", require("./routes/tasks"));

//////////////////////////////// Server Initialization ////////////////////////////////

if ( serverMode === "dev" ) {

app.listen(devPort, ()=> console.log('Tasks-Application running in development mode at ' + devPort));

} else {

	const httpsServer = https.createServer({
	  key: fs.readFileSync('/etc/letsencrypt/live/' + websiteUrl + '/privkey.pem'),
	  cert: fs.readFileSync('/etc/letsencrypt/live/' + websiteUrl + '/fullchain.pem'),
	}, app);

	httpsServer.listen(443);
	console.log("Listening 443");

	app.listen(80);
	console.log("Listening 80");

}