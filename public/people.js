function inviteKey(keyPress){
	// Allow users to submit a person invite by pressing the enter key while the invite input is in focus
	if(keyPress == 'Enter'){

		submitPost();

		return keyPress != 'Enter';

	}

	return

}

function submitPost(){
	// Send the email address of a user to invite to share tasks with to the server

	const email = document.getElementById("emailInput").value;
	placeFetch( "/people", "POST", { email: email }, ()=>{window.location.replace("/people")} );

}