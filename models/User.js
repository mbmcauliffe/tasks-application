const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

	_id: {
		type: String,
		required: true
	},
	firstName: {
		type: String,
		required: true
	},
	lastName: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true,
		lowercase: true
	},
	password: {
		type: String,
		required: true
	},
	isVerified: {
		type: Boolean,
		required: true,
		default: false
	},
	people: {
		type: {},
		required: true,
		default: {}
	},
	identifier: {
		type: String,
		required: false
	}
});

module.exports = mongoose.model( "User", userSchema );