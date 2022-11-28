var task = {
	id: null,
	title: null,
	description: null,
	startDate: null,
	endDate: null,
	people: [ document.getElementById("userId").value ]
}

async function submitPost() {

	// Store Form Data to the Task Object
	task.title = await document.getElementById("titleInput").value;
	task.description = await document.getElementById("descriptionInput").value;
	task.startDate = await document.getElementById("startDateInput").value;
	task.endDate = await new Date(document.getElementById("endDateInput").value + "T" + document.getElementById("timeSelect").value);

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
	
    const fragment = document.createDocumentFragment();

    const row = fragment.appendChild(document.createElement('div'));
    row.classList.add("flexRow");
    row.style.setProperty("justify-content", "flex-start");

    row.appendChild(document.createElement("div"));
    Array.from(row.children)[row.children.length-1].innerText = select.options[select.selectedIndex].text;

    row.appendChild(document.createElement("div"));
    Array.from(row.children)[row.children.length-1].classList.add("deleteSymbol");
    Array.from(row.children)[row.children.length-1].setAttribute("onclick", "removePerson('" + personId + "')");

    document.getElementById("peopleBlock").appendChild(fragment);
    Array.from(peopleBlock.children)[peopleBlock.children.length-1].id = "fragment" + personId;

    document.getElementById("personSelect")[0].selected = "selected";

    return

}

function removePerson ( personId ) {

	task.people.splice(task.people.indexOf(personId), 1);

	document.getElementById( "fragment" + personId ).remove();

	return

}

function editTask( taskId ){

	const taskData = JSON.parse(document.getElementById( "taskData" + taskId ).value);

	document.getElementById("promptHeading").innerText = "Edit Task";

	document.getElementById("titleInput").value = taskData.title;
	document.getElementById("descriptionInput").value = taskData.description;
	
	document.getElementById("startDateInput").value = new Date( taskData.startDate ).toISOString().split("T")[0];
	document.getElementById("endDateInput").value = new Date( taskData.endDate ).toISOString().split("T")[0];
	document.getElementById("timeSelect").value = new Date( taskData.endDate ).toISOString().split("T")[1].split(".")[0];

	for ( i=0; i<taskData.people.length; i++ ) {
		addPerson(taskData.people[i]);
	}
	
	raisePrompt();

}

function closeTaskEdit() {

	task.id = null;
	document.getElementById('promptHeading').innerText = 'New Task';

	document.getElementById("timeSelect")[0].selected = "selected";
	document.getElementById("personSelect")[0].selected = "selected";

	for ( i=1; i<task.people.length; i++ ) {

		document.getElementById( "fragment" + task.people[i] ).remove();

	}

	task.people = [ task.people[0] ];

	closePrompt(true);

}

closeTaskEdit();