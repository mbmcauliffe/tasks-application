function inviteKey(keyPress){
	// Allow users to submit a person invite by pressing the enter key while the invite input is in focus
	if(keyPress == 'Enter'){

		submitPost();

		return keyPress != 'Enter';

	}

	return

}

async function peopleFetch( endpoint, method, body ) {

	// Place the request
	const response = await fetch(endpoint, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify( body ),
    });

    if(response.status === 200){

    	window.location.replace("/people");
    	return
    	
    }

    // Status 400 is only sent with an error response, rendered here for the user
    if ( response.status === 400 ) {
    	const textResponse = await response.text();

    	const error = await JSON.parse(textResponse);
    	console.log(error);
    	raiseError(error);
    }

}

function submitPost(){
	// Send the email address of a user to invite to share tasks with to the server

	const email = document.getElementById("emailInput").value;
	peopleFetch( "/people", "POST", { email: email } );

}

function removePerson( id ){
	// Remove a person who has already been approved by both parties
	peopleFetch( "/people", "DELETE", { id: id } );

}

function removePending( email ){
	// Remove the database records of an invitation, whether appearing as pending or invited
	peopleFetch( "/people/pending", "DELETE", { email: email } );

}

function approvePending( email ){
	// Send the email address to the server of a person approved to share tasks with the user
	peopleFetch( "/people/approve", "POST", { email: email } );

}