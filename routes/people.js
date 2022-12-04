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

router.get('/', async (req, res, next) => {

	const user = await User.findOne({ email: req.headers.user.email });

	var people = [];

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

	if ( req.headers.user.email == req.body.email ) {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "You cannot invite yourself."
		}));
	}

	const user = await User.findOne({ email: req.headers.user.email});
	const inviteEmail = req.body.email.toLowerCase();
	const invitedUser = await User.findOne({ email: inviteEmail });

	if ( user.invited.indexOf( inviteEmail ) >= 0 ) {
		return res.status(200).send()
	}

	await user.invited.push( inviteEmail );

	await user.save();

	if ( invitedUser !== null ) {

		if ( invitedUser.pending.indexOf( user.email ) >= 0 ) {
			return res.status(200).send()
		}

		await invitedUser.pending.push( user.email );

		await invitedUser.save();

	}

	return res.status(200).send()

});

router.post('/approve', async (req, res) => {

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