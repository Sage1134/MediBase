const localIP = "10.200.8.117";

function register(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    const data = {
        purpose: "registration",
        username: username,
        password: password,
      };

    if (password === confirm) {
        const socket = new WebSocket('ws://' + localIP + ':1134');

        socket.onopen = function (event) {
            socket.send(JSON.stringify(data));
        };

        socket.onmessage = function(event) {
            var data = JSON.parse(event.data);
            if (data["purpose"] == "registerResult") {
                alert(data["result"]);
            }
            socket.close(1000, "Closing Connection");
        };

        document.getElementById("username").value = "";
        document.getElementById("password").value = "";
        document.getElementById("confirm").value = "";
    }
    else {
        alert("Passwords do not match!")
    }
}