const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({

	_id: {
		type: String,
		required: true
	},
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
		type: Date,
		required: true
	},
	endDate: {
		type: Date,
		required: true
	}

});

module.exports = mongoose.model( "Task", taskSchema );