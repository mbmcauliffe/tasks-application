const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({

	title: {
		type: String,
		required: true
	},
	description: {
		type: String,
		required: true
	},
	people: {
		type: Array,
		required: true
	},
	startDate: {
		type: Number,
		required: true
	},
	endDate: {
		type: Number,
		required: true
	}

});

module.exports = mongoose.model( "Task", taskSchema );