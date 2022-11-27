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
	task.endDate = await document.getElementById("endDateInput").value;

	const response = await fetch('/task', {
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