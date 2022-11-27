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

function addPerson () {

	const select = document.getElementById("personSelect");
	const personId = select.value;

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

    return

}

function removePerson ( personId ) {

	task.people.splice(task.people.indexOf(personId), 1);

	document.getElementById( "fragment" + personId ).remove();

	return

}