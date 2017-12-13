function logout(evt) {
	var form = document.getElementById("form-logout");
	if (form){
		form.submit();
		evt.preventDefault();
	}
}

document.addEventListener("DOMContentLoaded", function () {
	var elm = document.getElementById("logout");
	if (elm) {
		elm.addEventListener("click", logout, false);
	}
}, false);


