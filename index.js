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

// Add Middleware
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const logger = require("./node_modules/mbmcauliffe-utilities/src/logger");
const mongoSanitize = require('express-mongo-sanitize');

// Auth Modules
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Server Configuration
const selfPort = 3000;
const tokenSecret = "cheese" //crypto.randomBytes(128).toString("HEX");

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
		return res.status(401).redirect("/login");
	}

	jwt.verify(req.headers.authorization, tokenSecret, async (err, tokenData) => {

		// Reject if the token is invalid
		if(err){

			// Set the Authorization Header to a useless value
			res.set("Access-Control-Expose-Headers", "authorization");
			res.set("authorization", "Bearer " + "Rejected Token");

			// Invalidate the user's authorization cookie
			res.clearCookie('authorization', { httpOnly:true, /*dev secure:true,*/ maxAge:604800000 /* Miliseconds */ });

			return res.status(401).redirect("/login");

		}

		// Check the database for the user's email address
		const existingUser = await User.findOne({ email: tokenData.email });

		// Reject if the user is not currently in the database
		if ( existingUser == null ) {
			return res.status(403).redirect("/login");
		}

		// Attach the user's information to be used later in the application
		req.headers.user = {
			id: await existingUser._id,
			email: await existingUser.email,
			people: await existingUser.people,
			pending: await existingUser.pending,
			invited: await existingUser.invited,
			isVerified: await existingUser.isVerified
		};

		// Create a token to be sent back to the user browser
		const userToken = jwt.sign({ email: existingUser.email }, tokenSecret, {expiresIn: '604800s'});

		// Send the user's token as both and authorization header and as a cookie
		res.set("Access-Control-Expose-Headers", "authorization");
		res.set("authorization", "Bearer " + userToken);
		res.cookie('authorization', "Bearer " + userToken, { httpOnly:true, sameSite: "Strict", /*dev secure:true,*/ maxAge:604800000 /* Miliseconds */ });

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

async function importPending ( email ) {

	const users = await User.find();
	var pending = [];

	for ( i=0; i<users.length; i++ ) {

		if ( users[i].invited.indexOf( email ) >= 0 ) {
			pending.push( users[i].email );
		}

	}

	return pending

}

//////////////////////////////// Middleware ////////////////////////////////

// Reference Configuration
app.set('view-engine', 'ejs');
app.set('views', './views');
app.use(express.static('./public'));

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

app.get('/login', async (req, res) => {

	// Prevent logged-in users from using this route
	if ( req.headers.authorization ) {
		return res.redirect("/");
	}

	return res.render("login.ejs");

});

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
	res.cookie('authorization', "Bearer " + userToken, { httpOnly:true, sameSite: "Strict", /*dev secure:true,*/ maxAge:604800000 /* Miliseconds */ });
	
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
	user.pending = await importPending( user.email );

	// Save the new user
	user.save();

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

app.post("/confirm", ( req, res )=>{
	// Send a user an email redirecting them to a GET route with their unique identifier

	const identifier = crypto.randomBytes(16).toString("HEX");

	const date = new Date();

	emailTokens.push({
		token: identifier,
		user: req.headers.user.id,
		created: date
	});

	return res.sendStatus(200)

});

app.get("/confirm/:identifier", ( req, res )=>{
	// Check the url-based single-use identifier, render a different page depending on the success of the check

	

	return res.sendStatus(200)

});

app.use("/people", require("./routes/people"));
app.use("/", require("./routes/tasks"));

//////////////////////////////// Server Initialization ////////////////////////////////

app.listen(selfPort, ()=> console.log('Tasks-Application running at ' + selfPort));