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
	people: {
		type: Array,
		required: true,
		default: []
	},
	pending: {
		type: Array,
		required: true,
		default: []
	},
	invited: {
		type: Array,
		required: true,
		default: []
	},
	isVerified: {
		type: Boolean,
		required: true,
		default: false
	}

});

module.exports = mongoose.model( "User", userSchema );