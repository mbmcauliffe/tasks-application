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
const router = express.Router();
const nodemailer = require("nodemailer");

// Server Configuration
require('dotenv').config();
const websiteUrl = process.env.WEBSITE_URL;
const mailJetApiKey= process.env.MAILJET_API_KEY;
const mailJetSecretKey= process.env.MAILJET_SECRET_KEY;
const noReplyAddress = process.env.NO_REPLY_ADDRESS;

//////////////////////////////// MongoDB ////////////////////////////////

const mongoose = require("mongoose");
mongoose.set('strictQuery', true);

// Import Data Models
const User = require("../models/User");

// Open and Log MongoDB Connection
mongoose.connect("mongodb://localhost/taskApplication");
const db = mongoose.connection;
db.on("error", (error)=>{ console.log("\n!!!!! Mongoose Error !!!!!\n\n" + error + "\n\n!!!!! Mongoose Error !!!!!\n"); });
db.once("open", ()=>{ console.log("People route connected to MongoDB"); });

//////////////////////////////// Server Functions ////////////////////////////////

async function sendMail( recipient, subject, htmlBody ) {
	
	mailjet( mailJetApiKey, mailjetSecretKey, noReplyAddress, "No Reply", recipient, "Tasks User", subject, htmlBody );

}

//////////////////////////////// Express Routes ////////////////////////////////

router.use(( req, res, next )=>{

	if ( req.headers.user.isVerified !== true ){
		return res.status( 403 ).render( "confirmEmail.ejs" );
	}

	next();

});

router.get('/', async (req, res, next) => {
	// Render the people page with a table containing all open invites and a table containing all accepted invites

	var people = [];
	const user = req.headers.user;

	// This to lookup and attach relevant data on each person based on the IDs in the user people array
	for ( i=0; i<user.people.length; i++ ) {

		const person = await User.findOne({ _id: user.people[i] });
		people.push({
			id: person._id,
			email: person.email,
			firstName: person.firstName,
			lastName: person.lastName
		});

	}

	return res.render("people.ejs", {
		people: people,
		pending: user.pending,
		invited: user.invited
	});

});

router.post('/', async (req, res, next) => {
	// Invite a user to collaborate on tasks

	if ( req.headers.user.email == req.body.email ) {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "You cannot invite yourself."
		}));
	}

	const user = await User.findOne({ email: req.headers.user.email});
	const inviteEmail = req.body.email.toLowerCase();
	const invitedUser = await User.findOne({ email: inviteEmail });

	// Prevent duplicate invites
	if ( user.invited.indexOf( inviteEmail ) >= 0 ) {
		return res.status(200).send()
	}

	await user.invited.push( inviteEmail );

	await user.save();

	if ( invitedUser !== null ) {
		// The invited user may or may not exist at the time of invite. If not, the invite will be imported at the time of user creation in the auth route

		// Prevent duplicate invites
		if ( invitedUser.pending.indexOf( user.email ) >= 0 ) {
			return res.status(200).send()
		}

		await invitedUser.pending.push( user.email );
		await invitedUser.save();

		const htmlBody = user.firstName + " " + user.lastName + " at " + user.email + " has invited you to collaborate on tasks at MBMcAuliffe Tasks. You can accept their invitation at <a clicktracking='off' href=https://" + websiteUrl + "/people target='_blank'>https://" + websiteUrl + "/people</a>";
		sendMail( invitedUser.email, user.firstName + " " + user.lastName + " has invited you to share tasks.", htmlBody );

	}

	return res.status(200).send()

});

router.post('/approve', async (req, res) => {
	// This to approve pending invites received from the passed email address

	const user = await User.findOne({ email: req.headers.user.email});
	const approvedUser = await User.findOne({ email: req.body.email });

	if ( approvedUser == null ) {
		return res.status(400).send(JSON.stringify({
			title: "Unable",
			message: "This user no longer exists."
		}));
	}

	await user.pending.splice(user.pending.indexOf( req.body.email ), 1);
	await approvedUser.invited.splice(approvedUser.invited.indexOf( user.email ), 1);

	await user.people.push( approvedUser._id );
	await approvedUser.people.push( user._id );

	await user.save();
	await approvedUser.save();

	return res.status(200).send()

});

router.delete('/pending', async (req, res) => {
	// This to bidirectionally remove all records of any invite between any two parties user and passed

	const user = await User.findOne({ email: req.headers.user.email});
	const deletedUser = await User.findOne({ email: req.body.email });

	if ( user.pending.indexOf( req.body.email ) >= 0 ) {
		await user.pending.splice(user.pending.indexOf( req.body.email ), 1);
	}
	if ( user.invited.indexOf( req.body.email ) >= 0 ) {
		await user.invited.splice(user.invited.indexOf( req.body.email ), 1);
	}
	await user.save();

	if ( deletedUser != null ) {

		if ( deletedUser.pending.indexOf( user.email ) >= 0 ) {
			await deletedUser.pending.splice(deletedUser.pending.indexOf( user.email ), 1);
		}
		if ( deletedUser.invited.indexOf( user.email ) >= 0 ) {
			await deletedUser.invited.splice(deletedUser.invited.indexOf( user.email ), 1);
		}
		await deletedUser.save();

	}

	return res.status(200).send()

});

router.delete('/', async (req, res) => {
	// This to remove a previously approved connection between two accounts

	const user = await User.findOne({ email: req.headers.user.email});
	const deletedUser = await User.findOne({ _id: req.body.id });

	if ( deletedUser == null ) {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "No User was found."
		}));
	}

	await user.people.splice(user.people.indexOf( req.body.id ), 1);
	await deletedUser.people.splice(deletedUser.people.indexOf( user.id ), 1);

	await user.save();
	await deletedUser.save();

	return res.status(200).send()

});

module.exports = router;