var task = {
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
	task.endDate = await new Date(document.getElementById("endDateInput").value + "T" + document.getElementById("timeSelect").value);
	task.status = await document.getElementById("statusSelect").value;

	const response = await fetch('/', {
		method: 'POST',
		headers: {
		'Content-Type': 'application/json'
	},
		body: JSON.stringify(task),
	});

	if(response.status === 200){

		window.location.replace("/");
		return

	}

	if ( response.status === 400 ) {
		const textResponse = await response.text();

		const error = await JSON.parse(textResponse);
		console.log(error);
		raiseError(error);
	}

	return

}

async function deleteTask() {

	const response = await fetch('/', {
		method: 'DELETE',
		headers: {
		'Content-Type': 'application/json'
	},
		body: JSON.stringify({ id: task.id })
	});

	if(response.status === 200){

		window.location.replace("/");
		return

	}

	if ( response.status === 400 ) {
		const textResponse = await response.text();

		const error = await JSON.parse(textResponse);
		console.log(error);
		raiseError(error);
	}

	return

}

function addPerson ( personId=null ) {

	const select = document.getElementById("personSelect");

	if ( personId == null ){
		personId = select.value;
	} else {
		select.value = personId;
	}

	if ( personId == "" || task.people.indexOf( personId ) >= 0) {
		return
	}

	task.people.push(personId);

	document.getElementById( "person" + personId ).style.setProperty("display", "flex");

    return

}

function removePerson ( personId ) {

	task.people.splice(task.people.indexOf(personId), 1);

	document.getElementById( "person" + personId ).style.setProperty("display", "none");

	return

}

function addZeros( value ){
	if( value < 10 ){
		value = "0" + value;
	}
	return value
}

function editTask( taskId ){

	const taskData = JSON.parse(document.getElementById( "taskData" + taskId ).value);

	task.id = taskId;
	document.getElementById("promptHeading").innerText = "Edit Task";

	document.getElementById("titleInput").value = taskData.title;
	document.getElementById("descriptionInput").value = taskData.description;
	
	document.getElementById("startDateInput").value = new Date( taskData.startDate ).toISOString().split("T")[0];
	document.getElementById("endDateInput").value = new Date( taskData.endDate ).toISOString().split("T")[0];

	const date = new Date(taskData.endDate);
	const hours = addZeros(date.getHours());
	const minutes = addZeros(date.getMinutes());
	const seconds = addZeros(date.getSeconds());
	document.getElementById("timeSelect").value =  hours + ":" + minutes + ":" + seconds;

	for ( i=0; i<taskData.people.length; i++ ) {
		addPerson(taskData.people[i]);
	}
	document.getElementById("personSelect")[0].selected = "selected";

	const statusSelect = document.getElementById("statusSelect");
	statusSelect.value = "Incomplete";
	if ( taskData.status === "Complete" ) {
		statusSelect.value = "Complete";
	}
	document.getElementById("statusSelectBlock").style.setProperty("display", "block");

	document.getElementById("deleteTaskButton").style.setProperty("display", "block");
	
	raisePrompt();

}

function closeTaskEdit() {

	task.id = null;
	document.getElementById('promptHeading').innerText = 'New Task';

	document.getElementById("timeSelect")[0].selected = "selected";
	document.getElementById("personSelect")[0].selected = "selected";
	document.getElementById("statusSelect")[0].selected = "selected";

	document.getElementById("statusSelectBlock").style.setProperty("display", "none");
	document.getElementById("deleteTaskButton").style.setProperty("display", "none");

	for ( i=0; i<task.people.length; i++ ) {

		document.getElementById( "person" + task.people[i] ).style.setProperty("display", "none");

	}

	document.getElementById( "person" + document.getElementById("userId").value ).style.setProperty("display", "flex");

	task.people = [ task.people[0] ];

	closePrompt(true);

}

function showCompleted(){

	const completionButton = document.getElementById("completionButton");

	const complete = document.querySelectorAll(".complete");

	for ( i=0; i<complete.length; i++ ) {
		complete[i].style.setProperty("display", "table-row");
	}

	completionButton.setAttribute("onclick", "hideCompleted()");
	completionButton.innerText = "Hide Completed";

}

function hideCompleted(){

	const completionButton = document.getElementById("completionButton");

	const complete = document.querySelectorAll(".complete");

	for ( i=0; i<complete.length; i++ ) {
		complete[i].style.setProperty("display", "none");
	}

	completionButton.setAttribute("onclick", "showCompleted()");
	completionButton.innerText = "Show Completed";

}

closeTaskEdit();
setDefaultStart();