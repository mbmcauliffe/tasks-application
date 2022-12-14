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
const crypto = require("crypto");

//////////////////////////////// MongoDB ////////////////////////////////

const mongoose = require("mongoose");
mongoose.set('strictQuery', true);

// Import Data Models
const User = require("../models/User");
const Task = require("../models/Task");

// Open and Log MongoDB Connection
mongoose.connect("mongodb://localhost/taskApplication");
const db = mongoose.connection;
db.on("error", (error)=>{ console.log("\n!!!!! Mongoose Error !!!!!\n\n" + error + "\n\n!!!!! Mongoose Error !!!!!\n"); });
db.once("open", ()=>{ console.log("Tasks route connected to MongoDB"); });

//////////////////////////////// Server Functions ////////////////////////////////

async function autoremoveTasks() {

	const tasks = await Task.find();

	var deletedTasksCount = 0;

	for ( i=0; i<tasks.length; i++ ) {

		if ( tasks[i].people.length == 0 ) {
			await Task.deleteOne({ _id: tasks[i].id });
			deletedTasksCount++
		}

	}

	if ( deletedTasksCount > 0 ) {
		console.log( "Removed " + deletedTasksCount + " vacant tasks from the database." );
	}

}
autoremoveTasks();

//////////////////////////////// Express Routes ////////////////////////////////

router.get("/csv", async ( req, res )=>{

	const user = await User.findOne({ email: req.headers.user.email }).lean();
	const tasks = await Task.find({ people: { $in: user._id } });

	var exportData = ["Title,Description,Status,Created By,Start Date,End Date"];
	const timeNow = new Date();
	
	for ( i=0; i<tasks.length; i++ ) {

		const startDate = new Date( tasks[i].startDate );
		const endDate = new Date( tasks[i].endDate );

		const milisecondsElapsed = ( timeNow.getTime() - startDate.getTime() );
		const milisecondsRemaining = await ( endDate.getTime() - timeNow.getTime() );

		if ( tasks[i].status != "Complete" ) {
			// Determine special status markers based on time criteria

			taskStatus = "Open";

			if ( milisecondsElapsed < 0 ) {
				taskStatus = "Future";
			}

			if ( milisecondsRemaining < 0 ) {
				taskStatus = "Overdue";
			}

		} else {
			taskStatus = "Complete";
		}

		exportData.push( tasks[i].title + "," + tasks[i].description + "," + taskStatus + "," + tasks[i].createdBy + "," + tasks[i].startDate + "," + tasks[i].endDate );

	}

	exportData = exportData.join( "\n" );

	return res.attachment('tasks.csv').send( exportData );

});

router.get('/', async (req, res, next) => {
	// Get all of the information relevant to every task and render the tasks page for the user

	var user = await User.findOne({ email: req.headers.user.email }).lean();
	var tasks = await Task.find({ people: { $in: user._id } }); 

	const timeNow = new Date();
	var people = [];

	for ( i=0; i<tasks.length; i++ ) {

		const startDate = new Date( tasks[i].startDate );
		const endDate = new Date( tasks[i].endDate );

		const milisecondsElapsed = ( timeNow.getTime() - startDate.getTime() );
		const milisecondsRemaining = await ( endDate.getTime() - timeNow.getTime() );

		if ( tasks[i].status != "Complete" ) {
			// Determine special status markers based on time criteria

			tasks[i].status = "Open";

			if ( milisecondsElapsed < 0 ) {
				tasks[i].status = "Future"
			}

			if ( milisecondsRemaining < 0 ) {
				tasks[i].status = "Overdue"
			}

		}

		// Calculate the number of days remaining to complete each task
		const daysRemaining = Math.trunc( milisecondsRemaining / 1000 / 60 / 60 / 24 );
		tasks[i].timeRemaining = daysRemaining + " Days";

		// Switch to hours remaining if the number of days remaining is less than 5
		if ( daysRemaining < 5 && daysRemaining > -5 ) {
			tasks[i].timeRemaining = Math.trunc( milisecondsRemaining / 1000 / 60 / 60 )+ " Hours";
		}

		for ( j=0; j<tasks[i].people.length; j++ ) {

			if ( user.people[ tasks[i].people[j] ] == null && tasks[i].people[j] != req.headers.user.id ) {

				user.people[ tasks[i].people[j] ] = { canShare: false };
				var addedPerson = await User.findOne({ _id: tasks[i].people[j] }).lean();
				addedPerson.people[ user._id ] = { canShare: false };
				await User.updateOne({ _id: tasks[i].people[j] }, { $set: { people: addedPerson.people }});

			}

		}

	}

	for ( id in user.people ) {

		const person = await User.findOne({ _id: id });

		people.push({
			id: person._id,
			email: person.email,
			firstName: person.firstName,
			lastName: person.lastName,
			canBeSharedWith: person.people[ user._id ].canShare
		});

	}

	await User.updateOne({ _id: user._id }, { $set: { people: user.people }});

	await tasks.sort( ( a, b )=>{
		// Sort tasks so that the tasks ending soonest are listed towards the top of the page when rendered
		return (a.endDate.getTime() - timeNow.getTime()) - (b.endDate.getTime() - timeNow.getTime())
	} );

	return res.render("tasks.ejs", {
		user: {
			id: user._id,
			firstName: user.firstName,
			lastName: user.lastName,
		},
		people: people,
		tasks: tasks
	});

});

router.post('/', async (req, res, next) => {
	// This to create a new task or edit an existing one, dependent on whether the user provides a task id in their request

	var task;

	if ( req.body.title == null || req.body.title == "") {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "The Title field is required."
		}));
	}

	if ( req.body.startDate == null || req.body.startDate == "") {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "The Start Date field is required."
		}));
	}

	if ( req.body.endDate == null || req.body.endDate == "") {
		return res.status(400).send(JSON.stringify({
			title: "Invalid",
			message: "The End Date field is required."
		}));
	}

	if ( req.body.id == null ) { // Create a new task with a new id if the user does not present a task id for an existing task to edit
		task = new Task();
		task._id = crypto.randomBytes(16).toString("HEX");
	} else {
		task = await Task.findOne({ _id: req.body.id });
	}

	if ( task == null ) {
		return res.status(400).send(JSON.stringify({
			title: "Something went wrong",
			message: "Please Try Again."
		}));
	}

	for ( i=0; i<req.body.people.length; i++ ) {

		if ( req.body.people[i] == req.headers.user.id ) {
			continue
		}

		const person = await User.findOne({ _id: req.body.people[i] });

		if ( person.people[ req.headers.user.id ].canShare !== true && task.people.indexOf( req.body.people[i] ) < 0 ) {
			return res.status(400).send(JSON.stringify({
				title: "Unauthorized",
				message: req.headers.user.firstName + " " + req.headers.user.lastName + " has not allowed you to add them to tasks."
			}));
		}

	}

	task.title = req.body.title;
	task.createdBy = req.headers.user.firstName + " " + req.headers.user.lastName;
	task.description = req.body.description;
	task.startDate = req.body.startDate;
	task.endDate = req.body.endDate;
	task.people = req.body.people;
	task.status = req.body.status;

	if ( task.status == null || task.status == "" ) {
		task.status = "Incomplete";
	}

	if ( task.description == null || req.body.description == ""){
		task.description = "-";
	}

	task.save();

	return res.status(200).send()

});

router.delete('/', async (req, res) => {
	// Delete a task with a given ID

	await Task.deleteOne({ _id: req.body.id });
	return res.status(200).send()

});

router.use((req, res)=>{
	res.status(404).render("404.ejs");
});

module.exports = router;