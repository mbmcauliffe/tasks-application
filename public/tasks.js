var refreshInterval;

var task = {
	// This object is updated by user input before and during its submission by POST
	id: null,
	title: null,
	description: null,
	startDate: null,
	endDate: null,
	status: null,
	people: [ document.getElementById("userId").value ]
}

async function submitPost() {

	// Store Form Data to the Task Object
	task.title = await document.getElementById("titleInput").value;
	task.description = await document.getElementById("descriptionInput").value;
	task.startDate = await document.getElementById("startDateInput").value;
	task.endDate = await document.getElementById("endDateInput").value;
	task.status = await document.getElementById("statusSelect").value;

	placeFetch( "/", "POST", task );

	return

}

function addPerson ( personId=null ) {
	// Display the person as a member of the task and add their id to the task object for POST requests
	// Does not actually send information to the server

	const select = document.getElementById("personSelect");
	// This function may be called by the user or by other functions in this script with or without a personId.
	if ( personId == null ){
		personId = select.value;
	} else {
		select.value = personId;
	}

	if ( personId == "" || task.people.indexOf( personId ) >= 0) {
		return
	}
	console.log(personId)

	// Add the personId to the task object
	task.people.push(personId);

	// Display the indicator that a person is included in the task, rendered by the server as display: none
	document.getElementById( "person" + personId ).style.setProperty("display", "flex");

    return

}

function removePerson ( personId ) {

	// Remove the person from the task object
	task.people.splice(task.people.indexOf(personId), 1);

	// Hide the indicator that the person is included in the task
	document.getElementById( "person" + personId ).style.setProperty("display", "none");

	return

}

function addZeros( value ){
	// Add leading zeros to single-digit date values in order to comply with html date input formatting
	if( value < 10 ){
		value = "0" + value;
	}
	return value
}

function editTask( taskId ){
	// Convert the prompt page to edit an already existing task instead of a new one and then raise it to the user's view.

	// Extract information about the task rendered into the html by the server.
	const taskData = JSON.parse(document.getElementById( "taskData" + taskId ).value);

	task.id = taskId;
	document.getElementById("promptHeading").innerText = "Edit Task";

	document.getElementById("titleInput").value = taskData.title;
	document.getElementById("createdBy").innerText = taskData.createdBy;
	document.getElementById("createdByBlock").style.setProperty("display", "block");
	document.getElementById("descriptionInput").value = taskData.description;
	
	var localStartDate = new Date( taskData.startDate );
	localStartDate.setMinutes(localStartDate.getMinutes() - localStartDate.getTimezoneOffset());
	document.getElementById("startDateInput").value = localStartDate.toISOString().slice(0,16);

	var localEndDate = new Date( taskData.endDate );
	localEndDate.setMinutes(localEndDate.getMinutes() - localEndDate.getTimezoneOffset());
	document.getElementById("endDateInput").value = localEndDate.toISOString().slice(0,16);

	// Display the indicators for each of the people on the task
	for ( i=0; i<taskData.people.length; i++ ) {
		addPerson(taskData.people[i]);
	}
	document.getElementById("personSelect")[0].selected = "selected";

	// Display whether the task is marked as completed or not and then make the status field visible
	const statusSelect = document.getElementById("statusSelect");
	statusSelect.value = "Incomplete";
	if ( taskData.status === "Complete" ) {
		statusSelect.value = "Complete";
	}
	document.getElementById("statusSelectBlock").style.setProperty("display", "block");

	// Make the delete task button visible
	document.getElementById("deleteTaskButton").style.setProperty("display", "block");

	clearInterval( refreshInterval ); // Prevent the page from refreshing while the user is editing a task
	
	raisePrompt();

}

function closeTaskEdit() {
	// Return the prompt window to its original format if the user cancels an edit on an existing task

	task.id = null;
	document.getElementById('promptHeading').innerText = 'New Task';

	// Return the selects to their default values
	document.getElementById("personSelect")[0].selected = "selected";
	document.getElementById("statusSelect")[0].selected = "selected";

	// Hide the edit-specific elements
	document.getElementById("createdByBlock").style.setProperty("display", "none");
	document.getElementById("statusSelectBlock").style.setProperty("display", "none");
	document.getElementById("deleteTaskButton").style.setProperty("display", "none");

	for ( i=0; i<task.people.length; i++ ) {
		// Hide the indicators of people included in the task
		document.getElementById( "person" + task.people[i] ).style.setProperty("display", "none");
	}

	// Display the indicator that the user is a member of the newly created task
	document.getElementById( "person" + document.getElementById("userId").value ).style.setProperty("display", "flex");

	// Remove all people from the task but the user
	task.people = [ task.people[0] ];

	// Restart the refresh timer
	refreshInterval = setInterval( ()=>{ window.location.replace("/"); }, 900000 );

	closePrompt(true);

}

function showCompleted(){
	// Show the completed tasks rendered as display:none by the server when the user clicks on the show completed button

	const completionButton = document.getElementById("completionButton");

	const complete = document.querySelectorAll(".complete");

	for ( i=0; i<complete.length; i++ ) {
		complete[i].style.setProperty("display", "table-row");
	}

	// Change the text and behavior of the show completed button
	completionButton.setAttribute("onclick", "hideCompleted()");
	completionButton.innerText = "Hide Completed";

}

function hideCompleted(){
	// Hide the completed tasks when the user clicks on the hide completed button

	const completionButton = document.getElementById("completionButton");

	const complete = document.querySelectorAll(".complete");

	for ( i=0; i<complete.length; i++ ) {
		complete[i].style.setProperty("display", "none");
	}

	// Change the text and behavior of the hide completed button
	completionButton.setAttribute("onclick", "showCompleted()");
	completionButton.innerText = "Show Completed";

}

function setDefaultStart (){
	// Set the start date of a new task to the present day within the user's own time zone

	var now = new Date();
	now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

	document.getElementById("startDateInput").value = now.toISOString().slice(0,16);

}

// Refresh every half-hour in order to keep hour numbers correct if not editing a task
refreshInterval = setInterval( ()=>{ window.location.replace("/"); }, 900000 );

// Clear any cached data from the prompt
closeTaskEdit();
setDefaultStart();