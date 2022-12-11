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
const mailjet = require("../node_modules/mbmcauliffe-utilities/src/mailjet");

// Server Configuration
require('dotenv').config();
const websiteUrl = process.env.WEBSITE_URL;
const mailjetApiKey= process.env.MAILJET_API_KEY;
const mailjetSecretKey= process.env.MAILJET_SECRET_KEY;
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
	
	mailjet( mailjetApiKey, mailjetSecretKey, noReplyAddress, websiteUrl, recipient, subject, htmlBody );

}

//////////////////////////////// Express Routes ////////////////////////////////

router.get('/', async (req, res, next) => {
	// Render the people page with a table containing all open invites and a table containing all accepted invites

	var people = [];
	const user = req.headers.user;

	// This to lookup and attach relevant data on each person based on the IDs in the user people array
	for ( let id in user.people ) {

		const person = await User.findOne({ _id: id });

		if ( person == null ) {
			continue
		}

		people.push({
			id: person._id,
			email: person.email,
			firstName: person.firstName,
			lastName: person.lastName,
			canShare: user.people[id].canShare
		});

	}

	return res.render("people.ejs", {
		people: people,
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

	var user = await User.findOne({ _id: req.headers.user.id}).lean();
	const inviteEmail = req.body.email.toLowerCase();
	var invitedUser = await User.findOne({ email: inviteEmail }).lean();

	if ( invitedUser == null ) {
		return res.status(400).send(JSON.stringify({
			title: "Not Found",
			message: "No user was found with that email address."
		}));
	}

	// Prevent duplicate invites
	if ( user.people[ invitedUser._id ] != null ) {
		return res.status(400).send(JSON.stringify({
			title: "Duplicate",
			message: "This person has already been added."
		}));
	}

	user.people[ invitedUser._id ] = { canShare: true };
	invitedUser.people[ user._id ] = { canShare: false };

	await User.updateOne({ _id: user._id }, { $set: { people: user.people }});
	await User.updateOne({ _id: invitedUser._id }, { $set: { people: invitedUser.people }});

	const htmlBody = "<style type='text/css'>*{ font-size: 20px; }</style>" + user.firstName + " " + user.lastName + " at " + user.email + " has invited you to collaborate on tasks with Tasks. You can accept their invitation at <a clicktracking='off' href=https://" + websiteUrl + "/people target='_blank'>https://" + websiteUrl + "/people</a>";
	sendMail( invitedUser.email, user.firstName + " " + user.lastName + " has invited you to share tasks.", htmlBody );

	return res.status(200).send()

});

router.patch('/', async (req, res) => {
	// This to change a person's canShare property within the user object

	const user = await User.findOne({ _id: req.headers.user.id}).lean();
	const person = await User.findOne({ _id: req.body.id });

	if ( person == null ) {

		delete user.people[ req.body.id ];
		await User.updateOne({ _id: user._id }, { $set: { people: user.people }});

		return res.status(400).send(JSON.stringify({
			title: "Unable",
			message: "This user no longer exists and will be removed on your next refresh."
		}));

	}

	user.people[ req.body.id ].canShare = req.body.value;

	await User.updateOne({ _id: user._id }, { $set: { people: user.people }});

	return res.status(200).send()

});

router.delete('/', async (req, res) => {
	// This to remove a previously approved connection between two accounts

	const user = await User.findOne({ _id: req.headers.user.id}).lean();
	const deletedPerson = await User.findOne({ _id: req.body.id }).lean();

	if ( deletedPerson == null ) {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "No User was found."
		}));
	}

	delete user.people[ deletedPerson._id ];
	delete deletedPerson.people[ user._id ];

	await User.updateOne({ _id: user._id }, { $set: { people: user.people }});
	await User.updateOne({ _id: deletedPerson._id }, { $set: { people: deletedPerson.people }});

	return res.status(200).send()

});

module.exports = router;